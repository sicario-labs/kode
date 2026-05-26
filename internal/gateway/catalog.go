package gateway

var DefaultCatalog = Catalog{
	Models: []Model{
		// Lite tier (free default, rate-limited, cost covered by key pool)
		{ID: "deepseek-v4-flash", Name: "DeepSeek V4 Flash", Provider: "openmodel", InputCost: 0.035, OutputCost: 0.07, Tier: TierLite, Protocol: ProtocolMessages, Description: "Fast reasoning, strong coding — Kode Lite default"},

		// Free tier (NVIDIA-subsidized via OpenRouter)
		{ID: "nvidia/nemotron-3-nano-30b-a3b:free", Name: "Nemotron 3 Nano", Provider: "openrouter", InputCost: 0, OutputCost: 0, Tier: TierLite, Description: "Free (via NVIDIA) — Deep agentic reasoning"},

		// Pro tier (paid premium — deepseek-v4-pro, deepseek-r1)
		{ID: "deepseek-v4-pro", Name: "DeepSeek V4 Pro", Provider: "deepseek", InputCost: 0.435, OutputCost: 0.87, Tier: TierPro, Description: "Premium reasoning, best-in-class coding"},
		{ID: "deepseek-r1", Name: "DeepSeek R1", Provider: "deepseek", InputCost: 0.435, OutputCost: 0.87, Tier: TierPro, Description: "Deep chain-of-thought reasoning"},
	},
}
