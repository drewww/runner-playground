import 'reflect-metadata';
import { v4 as uuidv4 } from 'uuid';
import { ComponentStore } from './component-store';
import { ComponentUnion, SerializedEntity } from './component';
import { REQUIRED_COMPONENTS } from './decorators';

/**
 * Base entity class that manages components
 */
export class Entity {
  private readonly id: string;
  protected store: ComponentStore;
  private changedComponents: Set<ComponentUnion['type']> = new Set();
  private tags: Set<string> = new Set();

  constructor(id?: string) {
    this.id = id ?? Entity.generateId();
    this.store = new ComponentStore();
  }

  /**
   * Generate a unique entity ID using UUID v4
   */
  private static generateId(): string {
    return uuidv4();
  }

  /**
   * Get the entity's unique identifier
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get a component by type
   */
  getComponent<T extends ComponentUnion>(type: T['type']): T | undefined {
    return this.store.get(type);
  }

  /**
   * Set a component
   */
  setComponent<T extends ComponentUnion>(component: T): this {
    this.store.set({
      ...component,
      modified: true
    });
    this.changedComponents.add(component.type);
    return this;
  }

  /**
   * Check if entity has a specific component
   */
  hasComponent<T extends ComponentUnion>(type: T['type']): boolean {
    return this.store.has(type);
  }

  /**
   * Remove a component from the entity
   */
  removeComponent<T extends ComponentUnion>(type: T['type']): boolean {
    return this.store.remove(type);
  }

  /**
   * Validates that all required components are present
   * @throws Error if any required component is missing
   */
  protected validateRequiredComponents(): void {
    const required = Reflect.getMetadata(REQUIRED_COMPONENTS, this.constructor) || [];
    for (const type of required) {
      if (!this.hasComponent(type)) {
        throw new Error(`Entity ${this.id} is missing required component: ${type}`);
      }
    }
  }

  /**
   * Validates the entity's current state
   * @throws Error if validation fails
   */
  public validate(): void {
    // Required components
    this.validateRequiredComponents();
    
    // Future validation types could go here:
    // - Component dependencies
    // - Component data validation
    // - Entity state validation
    // - etc.
  }

  // Optional convenience methods for very common operations
  setPosition(x: number, y: number): this {
    return this.setComponent({ type: 'position', x, y });
  }

  /**
   * Get all components on this entity
   */
  getComponents(): ComponentUnion[] {
    return this.store.values();
  }

  /**
   * Get the number of components on this entity
   */
  getComponentCount(): number {
    return this.getComponents().length;
  }

  /**
   * Serialize entity to plain object
   */
  serialize(): SerializedEntity {
    return {
      id: this.id,
      components: this.getComponents(),
      tags: Array.from(this.tags)
    };
  }

  /**
   * Create an entity from serialized data
   * @throws Error if data is invalid
   */
  static deserialize(data: SerializedEntity): Entity {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid serialized data: must be an object');
    }
    if (!data.id || typeof data.id !== 'string') {
        throw new Error('Invalid serialized data: missing or invalid id');
    }
    if (!Array.isArray(data.components)) {
        throw new Error('Invalid serialized data: components must be an array');
    }

    const entity = new Entity(data.id);
    for (const component of data.components) {
        if (!component || typeof component !== 'object' || !('type' in component)) {
            throw new Error('Invalid serialized data: invalid component format');
        }
        entity.setComponent(component);
    }

    if (Array.isArray(data.tags)) {
      entity.addTags(data.tags);
    }

    return entity;
  }

  /**
   * Check if entity has all of the specified components
   */
  hasAllComponents<T extends ComponentUnion>(types: T['type'][]): boolean {
    return types.every(type => this.hasComponent(type));
  }

  /**
   * Check if entity has any of the specified components
   */
  hasAnyComponents<T extends ComponentUnion>(types: T['type'][]): boolean {
    return types.some(type => this.hasComponent(type));
  }

  /**
   * Get all component types on this entity
   */
  getComponentTypes(): ComponentUnion['type'][] {
    return this.getComponents().map(c => c.type);
  }

  /**
   * Check if entity lacks all of the specified components
   */
  doesNotHaveComponents<T extends ComponentUnion>(types: T['type'][]): boolean {
    return types.every(type => !this.hasComponent(type));
  }

  /**
   * Check if a specific component has been modified
   */
  hasComponentChanged<T extends ComponentUnion>(type: T['type']): boolean {
    return this.changedComponents.has(type);
  }

  /**
   * Get all component types that have been modified
   */
  getChangedComponents(): ComponentUnion['type'][] {
    return Array.from(this.changedComponents);
  }

  /**
   * Check if any components have been modified
   */
  hasChanges(): boolean {
    return this.changedComponents.size > 0;
  }

  /**
   * Clear all modification flags (typically called at end of frame)
   */
  clearChanges(): void {
    for (const component of this.getComponents()) {
      component.modified = false;
    }
    this.changedComponents.clear();
  }

  /**
   * Add a tag to the entity
   */
  addTag(tag: string): this {
    this.tags.add(tag);
    return this;
  }

  /**
   * Remove a tag from the entity
   */
  removeTag(tag: string): boolean {
    return this.tags.delete(tag);
  }

  /**
   * Check if entity has a specific tag
   */
  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  /**
   * Get all tags on this entity
   */
  getTags(): string[] {
    return Array.from(this.tags);
  }

  /**
   * Add multiple tags at once
   */
  addTags(tags: string[]): this {
    tags.forEach(tag => this.tags.add(tag));
    return this;
  }

  /**
   * Remove all tags from the entity
   */
  clearTags(): void {
    this.tags.clear();
  }
} 