import { describe, it, expect } from 'vitest';
import { validate as uuidValidate } from 'uuid';
import { Entity } from '../entity';
import { PositionComponent } from '../component';

describe('Entity', () => {
  it('can be constructed with an explicit id', () => {
    const id = 'test-entity';
    const entity = new Entity(id);
    
    expect(entity).toBeInstanceOf(Entity);
    expect(entity.getId()).toBe(id);
  });

  it('generates valid UUIDs when no id provided', () => {
    const entity = new Entity();
    expect(uuidValidate(entity.getId())).toBe(true);
  });

  it('generates unique ids for different entities', () => {
    const entity1 = new Entity();
    const entity2 = new Entity();
    
    expect(entity1.getId()).not.toBe(entity2.getId());
    expect(uuidValidate(entity1.getId())).toBe(true);
    expect(uuidValidate(entity2.getId())).toBe(true);
  });

  it('can add and retrieve a component', () => {
    const entity = new Entity();
    const position: PositionComponent = { 
      type: 'position',
      x: 10, 
      y: 20 
    };

    entity.setComponent(position);
    
    const retrieved = entity.getComponent('position');
    expect(retrieved).toEqual(position);
  });

  it('can add and remove a component', () => {
    const entity = new Entity();
    const position: PositionComponent = { 
      type: 'position',
      x: 10, 
      y: 20 
    };

    entity.setComponent(position);
    expect(entity.hasComponent('position')).toBe(true);

    const removed = entity.removeComponent('position');
    expect(removed).toBe(true);
    expect(entity.hasComponent('position')).toBe(false);
    expect(entity.getComponent('position')).toBeUndefined();
  });
}); 