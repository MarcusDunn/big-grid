import {AsyncVirtualizedGrid} from "../../src/lib/AsyncVirtualizedGrid/AsyncVirtualizedGrid";

describe('AsyncVirtualizedGrid.cy.ts', () => {
  it('empty', () => {
    cy.mount(<AsyncVirtualizedGrid fetch={async () => ({items: [], count: 0})}/>);
  })
})
