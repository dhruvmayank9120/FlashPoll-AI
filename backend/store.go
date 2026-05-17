package main

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	store := &Store{pool: pool}
	if err := store.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	if err := store.seed(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('General','Strategy','Product','Engineering','Design','Operations','HR','Marketing','Finance')),
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  insight TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS options_poll_text_unique
  ON options (poll_id, lower(option_text));

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Anonymous',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polls_category_idx ON polls(category);
CREATE INDEX IF NOT EXISTS polls_created_at_idx ON polls(created_at DESC);
CREATE INDEX IF NOT EXISTS options_poll_id_idx ON options(poll_id);
CREATE INDEX IF NOT EXISTS comments_poll_id_idx ON comments(poll_id);
`)
	return err
}

func (s *Store) seed(ctx context.Context) error {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM polls`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	samples := []struct {
		Question string
		Category string
		Options  []seedOption
	}{
		{
			Question: "Which sprint methodology should the team adopt this quarter?",
			Category: "Engineering",
			Options: []seedOption{
				{Text: "Scrum (2-week sprints)", Votes: 8},
				{Text: "Kanban (continuous flow)", Votes: 5},
				{Text: "Shape Up (6-week cycles)", Votes: 11},
				{Text: "Hybrid approach", Votes: 3},
			},
		},
		{
			Question: "How should we handle the Q3 product roadmap prioritisation?",
			Category: "Product",
			Options: []seedOption{
				{Text: "Customer-requested features first", Votes: 14},
				{Text: "Technical debt reduction", Votes: 6},
				{Text: "New market experiments", Votes: 9},
			},
		},
		{
			Question: "What is the preferred format for the next team offsite?",
			Category: "HR",
			Options: []seedOption{
				{Text: "2-day retreat offsite", Votes: 0},
				{Text: "Half-day local workshop", Votes: 0},
				{Text: "Virtual async activities", Votes: 0},
				{Text: "Monthly social events", Votes: 0},
			},
		},
	}

	for _, sample := range samples {
		if _, err := s.createPoll(ctx, sample.Question, sample.Category, false, nil, sample.Options); err != nil {
			return err
		}
	}
	return nil
}

type seedOption struct {
	Text  string
	Votes int
}

func (s *Store) ListPolls(ctx context.Context, category, search, sortBy string) ([]Poll, error) {
	orderBy := "p.created_at DESC"
	switch sortBy {
	case "votes":
		orderBy = "(SELECT COALESCE(SUM(o.vote_count), 0) FROM options o WHERE o.poll_id = p.id) DESC, p.created_at DESC"
	case "unanswered":
		orderBy = "(SELECT COALESCE(SUM(o.vote_count), 0) FROM options o WHERE o.poll_id = p.id) ASC, p.created_at DESC"
	}

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
SELECT p.id::text, p.question, p.category, p.ai_generated, p.insight, p.expires_at, p.created_at, p.updated_at
FROM polls p
WHERE ($1 = '' OR p.category = $1)
  AND ($2 = '' OR p.question ILIKE '%%' || $2 || '%%')
ORDER BY %s
`, orderBy), category, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	polls := []Poll{}
	for rows.Next() {
		poll, err := scanPoll(rows)
		if err != nil {
			return nil, err
		}
		if err := s.hydratePoll(ctx, &poll); err != nil {
			return nil, err
		}
		polls = append(polls, poll)
	}
	return polls, rows.Err()
}

func (s *Store) GetPoll(ctx context.Context, id string) (*Poll, error) {
	row := s.pool.QueryRow(ctx, `
SELECT id::text, question, category, ai_generated, insight, expires_at, created_at, updated_at
FROM polls
WHERE id = $1
`, id)
	poll, err := scanPoll(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	if err := s.hydratePoll(ctx, &poll); err != nil {
		return nil, err
	}
	return &poll, nil
}

func (s *Store) CreatePoll(ctx context.Context, req CreatePollRequest) (*Poll, error) {
	options := make([]seedOption, 0, len(req.Options))
	for _, option := range req.Options {
		text := strings.TrimSpace(option.Text)
		if text != "" {
			options = append(options, seedOption{Text: text})
		}
	}
	return s.createPoll(ctx, strings.TrimSpace(req.Question), req.Category, req.AIGenerated, req.ExpiresAt, options)
}

func (s *Store) createPoll(ctx context.Context, question, category string, aiGenerated bool, expiresAt *time.Time, options []seedOption) (*Poll, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	pollID := newUUID()
	_, err = tx.Exec(ctx, `
INSERT INTO polls (id, question, category, ai_generated, expires_at)
VALUES ($1, $2, $3, $4, $5)
`, pollID, question, category, aiGenerated, expiresAt)
	if err != nil {
		return nil, err
	}

	for index, option := range options {
		_, err = tx.Exec(ctx, `
INSERT INTO options (id, poll_id, option_text, vote_count, display_order)
VALUES ($1, $2, $3, $4, $5)
`, newUUID(), pollID, option.Text, option.Votes, index)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetPoll(ctx, pollID)
}

func (s *Store) UpdatePoll(ctx context.Context, id string, req UpdatePollRequest) (*Poll, error) {
	tag, err := s.pool.Exec(ctx, `
UPDATE polls
SET question = CASE WHEN $2 = '' THEN question ELSE $2 END,
    category = CASE WHEN $3 = '' THEN category ELSE $3 END,
    updated_at = now()
WHERE id = $1
`, id, strings.TrimSpace(req.Question), req.Category)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errNotFound
	}
	return s.GetPoll(ctx, id)
}

func (s *Store) Vote(ctx context.Context, pollID, optionID string) (*Poll, error) {
	tag, err := s.pool.Exec(ctx, `
UPDATE options o
SET vote_count = vote_count + 1
FROM polls p
WHERE o.poll_id = p.id
  AND p.id = $1
  AND o.id = $2
  AND (p.expires_at IS NULL OR p.expires_at > now())
`, pollID, optionID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errNotFound
	}

	_, err = s.pool.Exec(ctx, `UPDATE polls SET updated_at = now() WHERE id = $1`, pollID)
	if err != nil {
		return nil, err
	}
	return s.GetPoll(ctx, pollID)
}

func (s *Store) SaveInsight(ctx context.Context, id string, insight *string) (*Poll, error) {
	tag, err := s.pool.Exec(ctx, `UPDATE polls SET insight = $2, updated_at = now() WHERE id = $1`, id, insight)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errNotFound
	}
	return s.GetPoll(ctx, id)
}

func (s *Store) DeletePoll(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM polls WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (s *Store) AddComment(ctx context.Context, pollID, text, author string) (*Comment, *Poll, error) {
	if strings.TrimSpace(author) == "" {
		author = "Anonymous"
	}
	comment := Comment{}
	err := s.pool.QueryRow(ctx, `
INSERT INTO comments (id, poll_id, text, author)
VALUES ($1, $2, $3, $4)
RETURNING id::text, poll_id::text, text, author, created_at
`, newUUID(), pollID, strings.TrimSpace(text), strings.TrimSpace(author)).
		Scan(&comment.ID, &comment.PollID, &comment.Text, &comment.Author, &comment.CreatedAt)
	if err != nil {
		return nil, nil, err
	}
	comment.PublicID = comment.ID

	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return nil, nil, err
	}
	return &comment, poll, nil
}

func (s *Store) DeleteComment(ctx context.Context, pollID, commentID string) (*Poll, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM comments WHERE poll_id = $1 AND id = $2`, pollID, commentID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errNotFound
	}
	return s.GetPoll(ctx, pollID)
}

func (s *Store) Stats(ctx context.Context) (map[string]interface{}, error) {
	polls, err := s.ListPolls(ctx, "", "", "newest")
	if err != nil {
		return nil, err
	}

	totalVotes := 0
	byCategory := map[string]int{}
	aiPolls := 0
	for _, poll := range polls {
		totalVotes += poll.TotalVotes
		byCategory[poll.Category]++
		if poll.AIGenerated {
			aiPolls++
		}
	}

	trendingPolls, err := s.ListPolls(ctx, "", "", "votes")
	if err != nil {
		return nil, err
	}
	trending := []map[string]interface{}{}
	for index, poll := range trendingPolls {
		if index >= 3 {
			break
		}
		trending = append(trending, map[string]interface{}{
			"id":         poll.ID,
			"question":   poll.Question,
			"totalVotes": poll.TotalVotes,
		})
	}

	return map[string]interface{}{
		"totalPolls": len(polls),
		"totalVotes": totalVotes,
		"byCategory": byCategory,
		"trending":   trending,
		"aiPolls":    aiPolls,
	}, nil
}

func (s *Store) hydratePoll(ctx context.Context, poll *Poll) error {
	options, total, err := s.loadOptions(ctx, poll.ID)
	if err != nil {
		return err
	}
	poll.Options = options
	poll.TotalVotes = total
	poll.Results = make([]Result, 0, len(options))
	for i := range poll.Options {
		percent := 0
		if total > 0 {
			percent = int(float64(poll.Options[i].Votes)/float64(total)*100 + 0.5)
		}
		poll.Options[i].Percent = percent
		poll.Results = append(poll.Results, Result{
			ID:      poll.Options[i].ID,
			Text:    poll.Options[i].Text,
			Votes:   poll.Options[i].Votes,
			Percent: percent,
		})
	}

	comments, err := s.loadComments(ctx, poll.ID)
	if err != nil {
		return err
	}
	poll.Comments = comments

	poll.ExpiresAtDB = poll.ExpiresAt
	poll.CreatedAtDB = poll.CreatedAt
	poll.UpdatedAtDB = poll.UpdatedAt
	if poll.ExpiresAt != nil {
		remaining := time.Until(*poll.ExpiresAt).Milliseconds()
		if remaining <= 0 {
			remaining = 0
			poll.IsExpired = true
		}
		poll.ExpiresIn = &remaining
	}
	return nil
}

func (s *Store) loadOptions(ctx context.Context, pollID string) ([]Option, int, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, poll_id::text, option_text, vote_count, display_order
FROM options
WHERE poll_id = $1
ORDER BY display_order, created_at
`, pollID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	options := []Option{}
	total := 0
	for rows.Next() {
		option := Option{}
		if err := rows.Scan(&option.ID, &option.PollID, &option.Text, &option.Votes, &option.DisplayOrder); err != nil {
			return nil, 0, err
		}
		option.PublicID = option.ID
		option.OptionText = option.Text
		option.VoteCount = option.Votes
		total += option.Votes
		options = append(options, option)
	}
	return options, total, rows.Err()
}

func (s *Store) loadComments(ctx context.Context, pollID string) ([]Comment, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, poll_id::text, text, author, created_at
FROM comments
WHERE poll_id = $1
ORDER BY created_at DESC
`, pollID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []Comment{}
	for rows.Next() {
		comment := Comment{}
		if err := rows.Scan(&comment.ID, &comment.PollID, &comment.Text, &comment.Author, &comment.CreatedAt); err != nil {
			return nil, err
		}
		comment.PublicID = comment.ID
		comments = append(comments, comment)
	}
	return comments, rows.Err()
}

type pollScanner interface {
	Scan(dest ...interface{}) error
}

func scanPoll(row pollScanner) (Poll, error) {
	poll := Poll{}
	var insight pgtype.Text
	var expiresAt pgtype.Timestamptz
	err := row.Scan(
		&poll.ID,
		&poll.Question,
		&poll.Category,
		&poll.AIGenerated,
		&insight,
		&expiresAt,
		&poll.CreatedAt,
		&poll.UpdatedAt,
	)
	if err != nil {
		return poll, err
	}

	poll.PublicID = poll.ID
	if insight.Valid {
		value := insight.String
		poll.Insight = &value
	}
	if expiresAt.Valid {
		value := expiresAt.Time
		poll.ExpiresAt = &value
	}
	return poll, nil
}

func newUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
