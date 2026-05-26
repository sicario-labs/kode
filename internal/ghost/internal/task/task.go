
package task

// Task defines a generic task interface.
type Task interface {
    Execute() error
}

// NewTask creates a new task with the given name.
func NewTask(name string) Task {
    return &task{name: name}
}

type task struct {
    name string
}

func (t *task) Execute() error {
    // Placeholder implementation
    return nil
}
