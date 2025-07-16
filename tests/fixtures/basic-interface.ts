export interface User {
  id: number;
  name: string;
  email?: string;
  active: boolean;
}

export interface Product {
  id: number;
  title: string;
  price: number;
  inStock: boolean;
  tags: string[];
}
