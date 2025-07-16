export interface User {
  id: number;
  name: string;
  email?: string;
}

export interface ApiResponse {
  status: "success" | "error";
  data: string | number | null;
  timestamp: Date;
}

export interface TaskList {
  id: number;
  tasks: Task[];
  completed: boolean;
}

export interface Task {
  id: number;
  title: string;
  priority: "low" | "medium" | "high";
  assignee?: User;
}
