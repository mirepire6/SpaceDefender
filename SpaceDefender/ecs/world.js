export const createWorld = (entities, components, state) => ({
    entities,
    components,
    gameOver: false,
    ...state
});
