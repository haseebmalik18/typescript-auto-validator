export interface User {
  id: number;
  name: string;
  email?: string;
}

export interface Address {
  street: string;
  city: string;
  zipCode: string;
}

export interface UserProfile {
  id: number;
  name: string;
  address: Address;
  settings: {
    theme: "light" | "dark";
    notifications: boolean;
  };
}

export interface Company {
  name: string;
  employees: User[];
  headquarters: Address;
}
