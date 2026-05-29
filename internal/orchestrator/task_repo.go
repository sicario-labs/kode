package orchestrator

import "sync"

type TaskRepo struct {
	mu      sync.RWMutex
	tasks   map[string]SubTask
	results map[string]SubTaskResult
}

func NewTaskRepo() *TaskRepo {
	return &TaskRepo{
		tasks:   make(map[string]SubTask),
		results: make(map[string]SubTaskResult),
	}
}

func (r *TaskRepo) Add(task SubTask) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tasks[task.ID] = task
}

func (r *TaskRepo) Get(id string) (SubTaskResult, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result, ok := r.results[id]
	return result, ok
}

func (r *TaskRepo) Complete(id string, result SubTaskResult) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.results[id] = result
}

func (r *TaskRepo) IsComplete(id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.results[id]
	return ok
}

func (r *TaskRepo) AllResults() []SubTaskResult {
	r.mu.RLock()
	defer r.mu.RUnlock()
	results := make([]SubTaskResult, 0, len(r.results))
	for _, r := range r.results {
		results = append(results, r)
	}
	return results
}

func (r *TaskRepo) PendingTasks() []SubTask {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var pending []SubTask
	for _, t := range r.tasks {
		if _, done := r.results[t.ID]; !done {
			pending = append(pending, t)
		}
	}
	return pending
}
