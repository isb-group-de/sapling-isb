/** @extends {Array<unknown>} */
class Collection extends Array {
  /** @param {unknown} owner */
  constructor(owner) {
    super();
    this.owner = owner;
  }

  /** @param {...unknown} items */
  add(...items) {
    this.push(...items);
  }
}

class EntityManager {}

class DriverException extends Error {
  /** @param {Error} previous */
  constructor(previous) {
    super(previous.message);
    Object.assign(this, previous);
  }
}

class RequestContext {
  /**
   * @param {{ fork?: (options: { useContext: boolean }) => unknown }} em
   * @param {() => unknown} next
   */
  static create(em, next) {
    if (typeof em?.fork === 'function') {
      em.fork({ useContext: true });
    }

    return next();
  }
}

class Type {
  /** @param {unknown} value */
  convertToDatabaseValue(value) {
    return value;
  }

  /** @param {unknown} value */
  convertToJSValue(value) {
    return value;
  }

  compareAsType() {
    return 'string';
  }

  ensureComparable() {
    return true;
  }
}

class MikroORM {
  static async init() {
    return new MikroORM();
  }

  async close() {
    return undefined;
  }
}

const coreExports = {
  Collection,
  EntityManager,
  DriverException,
  MikroORM,
  RequestContext,
  Type,
  Options: class Options {},
  ReferenceKind: {
    SCALAR: 'scalar',
    ONE_TO_ONE: '1:1',
    ONE_TO_MANY: '1:m',
    MANY_TO_ONE: 'm:1',
    MANY_TO_MANY: 'm:n',
    EMBEDDED: 'embedded',
  },
  LockMode: {
    NONE: 0,
    OPTIMISTIC: 1,
    PESSIMISTIC_READ: 2,
    PESSIMISTIC_WRITE: 3,
    PESSIMISTIC_PARTIAL_WRITE: 4,
    PESSIMISTIC_WRITE_OR_FAIL: 5,
    PESSIMISTIC_PARTIAL_READ: 6,
    PESSIMISTIC_READ_OR_FAIL: 7,
  },
  IsolationLevel: { SERIALIZABLE: 'serializable' },
  TransactionPropagation: { REQUIRED: 'required' },
  Cascade: new Proxy(
    {},
    {
      get: (_, property) => property,
    },
  ),
  DeferMode: {
    INITIALLY_DEFERRED: 'deferred',
    INITIALLY_IMMEDIATE: 'immediate',
  },
  raw: /** @param {unknown} value */ (value) => value,
};

module.exports = new Proxy(coreExports, {
  get(target, property) {
    if (property in target) {
      return Reflect.get(target, property);
    }

    return () => undefined;
  },
});
