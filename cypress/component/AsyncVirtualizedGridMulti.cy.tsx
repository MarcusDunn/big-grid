import {AsyncVirtualizedGrid} from "../../src/lib/AsyncVirtualizedGrid/AsyncVirtualizedGrid";

describe('AsyncVirtualizedGrid.cy.ts', () => {
  it('multi', () => {
    cy.mount(<AsyncVirtualizedGrid fetch={async () => ({items: Array(100).fill(0).map((_, i) => ({id: i})), count: 100_000})}/>);
  })
})