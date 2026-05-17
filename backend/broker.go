package main

import (
	"encoding/json"
	"sync"
)

type Broker struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

func NewBroker() *Broker {
	return &Broker{clients: map[chan []byte]struct{}{}}
}

func (b *Broker) Subscribe() (chan []byte, func()) {
	ch := make(chan []byte, 8)

	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()

	return ch, func() {
		b.mu.Lock()
		delete(b.clients, ch)
		close(ch)
		b.mu.Unlock()
	}
}

func (b *Broker) Broadcast(payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.clients {
		select {
		case ch <- data:
		default:
		}
	}
}
