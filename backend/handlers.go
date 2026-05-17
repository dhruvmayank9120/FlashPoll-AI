package main

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Handler struct {
	store  *Store
	broker *Broker
	cfg    Config
}

func NewHandler(store *Store, broker *Broker, cfg Config) *Handler {
	return &Handler{store: store, broker: broker, cfg: cfg}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", h.health)
	mux.HandleFunc("GET /api/polls", h.listPolls)
	mux.HandleFunc("GET /api/polls/export.csv", h.exportCSV)
	mux.HandleFunc("GET /api/polls/stats", h.stats)
	mux.HandleFunc("GET /api/polls/stream", h.stream)
	mux.HandleFunc("GET /api/polls/{id}", h.getPoll)
	mux.HandleFunc("POST /api/polls", h.createPoll)
	mux.HandleFunc("PATCH /api/polls/{id}", h.updatePoll)
	mux.HandleFunc("PATCH /api/polls/{id}/vote", h.vote)
	mux.HandleFunc("PATCH /api/polls/{id}/insight", h.saveInsight)
	mux.HandleFunc("POST /api/polls/{id}/comments", h.addComment)
	mux.HandleFunc("DELETE /api/polls/{id}/comments/{commentId}", h.deleteComment)
	mux.HandleFunc("DELETE /api/polls/{id}", h.deletePoll)

	mux.HandleFunc("POST /api/ai/generate-poll", h.aiGeneratePoll)
	mux.HandleFunc("POST /api/ai/improve-question", h.aiImproveQuestion)
	mux.HandleFunc("POST /api/ai/suggest-category", h.aiSuggestCategory)
	mux.HandleFunc("POST /api/ai/insight", h.aiInsight)
	mux.HandleFunc("POST /api/ai/suggest-options", h.aiSuggestOptions)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	status := "connected"
	if err := h.store.Ping(r.Context()); err != nil {
		status = "error: " + err.Error()
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"db":        "PostgreSQL " + status,
		"aiEnabled": h.cfg.GroqAPIKey != "",
		"timestamp": time.Now().UTC(),
	})
}

func (h *Handler) listPolls(w http.ResponseWriter, r *http.Request) {
	polls, err := h.store.ListPolls(
		r.Context(),
		strings.TrimSpace(r.URL.Query().Get("category")),
		strings.TrimSpace(r.URL.Query().Get("search")),
		strings.TrimSpace(r.URL.Query().Get("sort")),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, polls)
}

func (h *Handler) getPoll(w http.ResponseWriter, r *http.Request) {
	poll, err := h.store.GetPoll(r.Context(), r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err, "Poll not found")
		return
	}
	writeJSON(w, http.StatusOK, poll)
}

func (h *Handler) createPoll(w http.ResponseWriter, r *http.Request) {
	var req CreatePollRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if validationError := validatePollInput(req.Question, req.Category, req.Options); validationError != "" {
		writeError(w, http.StatusUnprocessableEntity, validationError)
		return
	}
	if req.Category == "" {
		req.Category = "General"
	}

	poll, err := h.store.CreatePoll(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	writeJSON(w, http.StatusCreated, poll)
}

func (h *Handler) updatePoll(w http.ResponseWriter, r *http.Request) {
	var req UpdatePollRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	req.Question = strings.TrimSpace(req.Question)
	req.Category = strings.TrimSpace(req.Category)
	if req.Question == "" && req.Category == "" {
		writeError(w, http.StatusUnprocessableEntity, "Nothing to update")
		return
	}
	if req.Category != "" && !categories[req.Category] {
		writeError(w, http.StatusUnprocessableEntity, "Invalid category")
		return
	}

	poll, err := h.store.UpdatePoll(r.Context(), r.PathValue("id"), req)
	if err != nil {
		writeStoreError(w, err, "Poll not found")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	writeJSON(w, http.StatusOK, poll)
}

func (h *Handler) vote(w http.ResponseWriter, r *http.Request) {
	var req VoteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	if strings.TrimSpace(req.OptionID) == "" {
		writeError(w, http.StatusBadRequest, "optionId is required")
		return
	}

	poll, err := h.store.Vote(r.Context(), r.PathValue("id"), req.OptionID)
	if err != nil {
		writeStoreError(w, err, "Poll or option not found (or poll has expired)")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	writeJSON(w, http.StatusOK, poll)
}

func (h *Handler) saveInsight(w http.ResponseWriter, r *http.Request) {
	var req InsightRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	poll, err := h.store.SaveInsight(r.Context(), r.PathValue("id"), req.Insight)
	if err != nil {
		writeStoreError(w, err, "Poll not found")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	writeJSON(w, http.StatusOK, poll)
}

func (h *Handler) addComment(w http.ResponseWriter, r *http.Request) {
	var req CommentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusUnprocessableEntity, "Comment text is required")
		return
	}
	if len(req.Text) > 500 {
		writeError(w, http.StatusUnprocessableEntity, "Comment too long (max 500 chars)")
		return
	}

	comment, poll, err := h.store.AddComment(r.Context(), r.PathValue("id"), req.Text, req.Author)
	if err != nil {
		writeStoreError(w, err, "Poll not found")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	writeJSON(w, http.StatusCreated, comment)
}

func (h *Handler) deleteComment(w http.ResponseWriter, r *http.Request) {
	poll, err := h.store.DeleteComment(r.Context(), r.PathValue("id"), r.PathValue("commentId"))
	if err != nil {
		writeStoreError(w, err, "Poll or comment not found")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_UPDATED", "poll": poll})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deletePoll(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.store.DeletePoll(r.Context(), id); err != nil {
		writeStoreError(w, err, "Poll not found")
		return
	}
	h.broker.Broadcast(map[string]interface{}{"type": "POLL_DELETED", "pollId": id})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.Stats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *Handler) exportCSV(w http.ResponseWriter, r *http.Request) {
	polls, err := h.store.ListPolls(r.Context(), "", "", "newest")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="flashpoll-results.csv"`)
	writer := csv.NewWriter(w)
	defer writer.Flush()

	_ = writer.Write([]string{"Poll ID", "Question", "Category", "Option", "Votes", "Percent", "Total Votes", "Created"})
	for _, poll := range polls {
		for _, option := range poll.Options {
			_ = writer.Write([]string{
				poll.ID,
				poll.Question,
				poll.Category,
				option.Text,
				fmt.Sprint(option.Votes),
				fmt.Sprint(option.Percent),
				fmt.Sprint(poll.TotalVotes),
				poll.CreatedAt.Format(time.RFC3339),
			})
		}
	}
}

func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch, unsubscribe := h.broker.Subscribe()
	defer unsubscribe()

	fmt.Fprint(w, "data: {\"type\":\"CONNECTED\"}\n\n")
	flusher.Flush()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case data := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ":heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func validatePollInput(question, category string, options []OptionIn) string {
	if strings.TrimSpace(question) == "" {
		return "question is required"
	}
	if category != "" && !categories[category] {
		return "Invalid category"
	}
	if len(options) < 2 {
		return "Provide at least 2 options"
	}

	seen := map[string]bool{}
	validCount := 0
	for _, option := range options {
		text := strings.TrimSpace(option.Text)
		if text == "" {
			continue
		}
		key := strings.ToLower(text)
		if seen[key] {
			return "Voting options must be distinct"
		}
		seen[key] = true
		validCount++
	}
	if validCount < 2 {
		return "At least 2 non-empty options required"
	}
	if validCount > 6 {
		return "A poll can have at most 6 options"
	}
	return ""
}

func decodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeStoreError(w http.ResponseWriter, err error, fallback string) {
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, fallback)
		return
	}
	writeError(w, http.StatusInternalServerError, err.Error())
}
