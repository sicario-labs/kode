package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/kode/kode/internal/gateway"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	upstream := gateway.UpstreamConfig{
		OpenAIKey:    os.Getenv("OPENAI_API_KEY"),
		AnthropicKey: os.Getenv("ANTHROPIC_API_KEY"),
		DeepSeekKey:  os.Getenv("DEEPSEEK_API_KEY"),
		GoogleKey:    os.Getenv("GOOGLE_API_KEY"),
	}

	srv := gateway.NewServer(gateway.DefaultCatalog, upstream)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Kode Gateway listening on %s", addr)
	log.Printf("  Models: %d in catalog", len(gateway.DefaultCatalog.Models))
	log.Printf("  Lite pool: %d keys (round-robin)", len(gateway.KeysFromEnv("KODE_LITE_KEYS")))
	log.Printf("  Rate limit: 20 req/day per IP (Lite tier)")

	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatal(err)
	}
}
