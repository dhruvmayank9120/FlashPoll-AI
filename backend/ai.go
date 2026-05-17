package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const groqAPI = "https://api.groq.com/openai/v1/chat/completions"
const groqModel = "llama-3.3-70b-versatile"

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model       string        `json:"model"`
	Messages    []groqMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (h *Handler) callGroq(system, userMessage string, maxTokens int) (string, error) {
	if strings.TrimSpace(h.cfg.GroqAPIKey) == "" {
		return "", fmt.Errorf("GROQ_API_KEY not set")
	}

	body, err := json.Marshal(groqRequest{
		Model: groqModel,
		Messages: []groqMessage{
			{
				Role:    "system",
				Content: system,
			},
			{
				Role:    "user",
				Content: userMessage,
			},
		},
		MaxTokens:   maxTokens,
		Temperature: 0.4,
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, groqAPI, bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.GroqAPIKey)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var parsed groqResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", err
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return "", fmt.Errorf(parsed.Error.Message)
		}
		return "", fmt.Errorf("Groq API error: %s", res.Status)
	}

	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("Groq API returned no content")
	}

	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func (h *Handler) aiGeneratePoll(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Topic string `json:"topic"`
	}

	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Topic) == "" {
		writeError(w, http.StatusUnprocessableEntity, "topic is required")
		return
	}

	system := `You are a poll creation assistant for a professional team tool.
Return ONLY valid JSON. No markdown, no preamble.
Shape: { "question": string, "category": string, "options": string[], "expiresHours": number|null }
Categories: General, Strategy, Product, Engineering, Design, Operations, HR, Marketing, Finance
Rules: question <= 120 chars, 3-4 distinct options each <= 60 chars, professional tone.
Set expiresHours to a reasonable number (24-168) if the topic implies urgency, otherwise null.`

	raw, err := h.callGroq(system, "Generate a poll about: "+strings.TrimSpace(req.Topic), 512)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(cleanAIJSON(raw), &payload); err != nil {
		writeError(w, http.StatusBadGateway, "AI returned malformed data. Try again.")
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) aiImproveQuestion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Question string `json:"question"`
	}

	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Question) == "" {
		writeError(w, http.StatusUnprocessableEntity, "question is required")
		return
	}

	system := "Improve this poll question: clear, concise, engaging, professional. Return ONLY the improved text - no quotes, no explanation. Max 120 chars."

	improved, err := h.callGroq(system, strings.TrimSpace(req.Question), 150)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"improved": improved})
}

func (h *Handler) aiSuggestCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Question string `json:"question"`
	}

	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Question) == "" {
		writeError(w, http.StatusUnprocessableEntity, "question is required")
		return
	}

	system := "Return ONLY the best category name from: General, Strategy, Product, Engineering, Design, Operations, HR, Marketing, Finance. Nothing else."

	category, err := h.callGroq(system, strings.TrimSpace(req.Question), 20)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"category": strings.TrimSpace(category)})
}

func (h *Handler) aiInsight(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Question string   `json:"question"`
		Options  []Option `json:"options"`
	}

	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Question) == "" || len(req.Options) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "question and options required")
		return
	}

	total := 0
	for _, option := range req.Options {
		total += option.Votes
	}

	if total == 0 {
		writeError(w, http.StatusUnprocessableEntity, "No votes to analyse yet")
		return
	}

	lines := []string{}
	for _, option := range req.Options {
		percent := int(float64(option.Votes)/float64(total)*100 + 0.5)
		lines = append(lines, fmt.Sprintf(`"%s": %d votes (%d%%)`, option.Text, option.Votes, percent))
	}

	system := `You are a team analytics assistant. Write a concise 2-sentence professional insight about these poll results.
Note the leading choice, any close contests, and what the distribution implies for team alignment.
Plain paragraph only. No bullets. Max 80 words.`

	insight, err := h.callGroq(system, fmt.Sprintf("Poll: %q\nResults:\n%s\nTotal: %d", req.Question, strings.Join(lines, "\n"), total), 200)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"insight": insight})
}

func (h *Handler) aiSuggestOptions(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Question string   `json:"question"`
		Existing []string `json:"existing"`
	}

	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.Question) == "" {
		writeError(w, http.StatusUnprocessableEntity, "question is required")
		return
	}

	existing := ""
	if len(req.Existing) > 0 {
		existing = "\nExisting options: " + strings.Join(req.Existing, ", ")
	}

	system := `You are a poll assistant. Given a poll question, suggest 2 additional distinct answer options that complement the existing ones.
Return ONLY a JSON array of 2 strings. No markdown, no explanation. Each string <= 60 chars.`

	raw, err := h.callGroq(system, fmt.Sprintf("Question: %q%s", req.Question, existing), 100)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	var options []string
	if err := json.Unmarshal(cleanAIJSON(raw), &options); err != nil {
		writeError(w, http.StatusBadGateway, "AI returned malformed data")
		return
	}

	writeJSON(w, http.StatusOK, map[string][]string{"options": options})
}

func cleanAIJSON(raw string) []byte {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	return []byte(strings.TrimSpace(cleaned))
}