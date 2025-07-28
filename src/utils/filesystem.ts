/**
 * File system abstraction layer for better testability and error handling
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname } from "path";

export interface FileSystemOperations {
  writeFile(path: string, content: string): void;
  readFile(path: string): string;
  exists(path: string): boolean;
  ensureDir(path: string): void;
}

export class FileSystemService implements FileSystemOperations {
  writeFile(filePath: string, content: string): void {
    try {
      this.ensureDir(dirname(filePath));
      writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  readFile(filePath: string): string {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  exists(path: string): boolean {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  }

  ensureDir(dirPath: string): void {
    try {
      if (!this.exists(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Default instance
export const fileSystem = new FileSystemService();