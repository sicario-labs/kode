package gateway

type Tier string

const (
	TierLite Tier = "lite"
	TierPro  Tier = "pro"
)

type Model struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Provider    string  `json:"provider"`
	InputCost   float64 `json:"input_cost"`   // per 1M tokens in dollars
	OutputCost  float64 `json:"output_cost"`  // per 1M tokens in dollars
	Tier        Tier    `json:"tier"`
	Description string  `json:"description,omitempty"`
}

type Catalog struct {
	Models []Model `json:"models"`
}
