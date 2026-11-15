export const pipe = (...functions) => value =>
    functions.reduce((result, fn) => fn(result), value);
