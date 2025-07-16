export interface User {
  id: number;
  name: string;
  email?: string;
  active: boolean;
  roles: string[];
}

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  inStock: boolean;
  categories: Category[];
  metadata: {
    created: Date;
    updated: Date;
    tags: string[];
  };
}

export interface Category {
  id: number;
  name: string;
  parent?: Category;
}

export interface ApiResponse {
  status: "success" | "error" | "pending";
  data: User | Product | null;
  message?: string;
  timestamp: Date;
}

export interface TaskList {
  id: number;
  title: string;
  tasks: Task[];
  owner: User;
  settings: {
    isPublic: boolean;
    theme: "light" | "dark";
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  assignee?: User;
  dueDate?: Date;
  subtasks: SubTask[];
}

export interface SubTask {
  id: number;
  title: string;
  completed: boolean;
}
