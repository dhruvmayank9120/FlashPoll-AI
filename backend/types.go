package main

import (
	"encoding/json"
	"time"
)

var categories = map[string]bool{
	"General":     true,
	"Strategy":    true,
	"Product":     true,
	"Engineering": true,
	"Design":      true,
	"Operations":  true,
	"HR":          true,
	"Marketing":   true,
	"Finance":     true,
}

type Poll struct {
	ID          string     `json:"_id"`
	PublicID    string     `json:"id"`
	Question    string     `json:"question"`
	Category    string     `json:"category"`
	Options     []Option   `json:"options"`
	Results     []Result   `json:"results"`
	TotalVotes  int        `json:"totalVotes"`
	AIGenerated bool       `json:"aiGenerated"`
	Insight     *string    `json:"insight"`
	ExpiresAt   *time.Time `json:"expiresAt"`
	ExpiresAtDB *time.Time `json:"expires_at"`
	IsExpired   bool       `json:"isExpired"`
	ExpiresIn   *int64     `json:"expiresIn"`
	Comments    []Comment  `json:"comments"`
	CreatedAt   time.Time  `json:"createdAt"`
	CreatedAtDB time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	UpdatedAtDB time.Time  `json:"updated_at"`
}

type Option struct {
	ID           string `json:"_id"`
	PublicID     string `json:"id"`
	PollID       string `json:"poll_id"`
	Text         string `json:"text"`
	OptionText   string `json:"option_text"`
	Votes        int    `json:"votes"`
	VoteCount    int    `json:"vote_count"`
	Percent      int    `json:"percent"`
	DisplayOrder int    `json:"display_order"`
}

type Result struct {
	ID      string `json:"id"`
	Text    string `json:"text"`
	Votes   int    `json:"votes"`
	Percent int    `json:"percent"`
}

type Comment struct {
	ID        string    `json:"_id"`
	PublicID  string    `json:"id"`
	PollID    string    `json:"poll_id"`
	Text      string    `json:"text"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreatePollRequest struct {
	Question    string     `json:"question"`
	Category    string     `json:"category"`
	Options     []OptionIn `json:"options"`
	AIGenerated bool       `json:"aiGenerated"`
	ExpiresAt   *time.Time `json:"expiresAt"`
}

type OptionIn struct {
	Text string `json:"text"`
}

type UpdatePollRequest struct {
	Question string `json:"question"`
	Category string `json:"category"`
}

type VoteRequest struct {
	OptionID string `json:"optionId"`
}

type InsightRequest struct {
	Insight *string `json:"insight"`
}

type CommentRequest struct {
	Text   string `json:"text"`
	Author string `json:"author"`
}

func (r *CreatePollRequest) UnmarshalJSON(data []byte) error {
	var raw struct {
		Question    string            `json:"question"`
		Category    string            `json:"category"`
		Options     []json.RawMessage `json:"options"`
		AIGenerated bool              `json:"aiGenerated"`
		ExpiresAt   *time.Time        `json:"expiresAt"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	r.Question = raw.Question
	r.Category = raw.Category
	r.AIGenerated = raw.AIGenerated
	r.ExpiresAt = raw.ExpiresAt
	r.Options = make([]OptionIn, 0, len(raw.Options))

	for _, item := range raw.Options {
		var text string
		if err := json.Unmarshal(item, &text); err == nil {
			r.Options = append(r.Options, OptionIn{Text: text})
			continue
		}

		var option OptionIn
		if err := json.Unmarshal(item, &option); err != nil {
			return err
		}
		r.Options = append(r.Options, option)
	}
	return nil
}
