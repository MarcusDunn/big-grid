import {AsyncVirtualizedGrid} from "../../src/lib/AsyncVirtualizedGrid/AsyncVirtualizedGrid";

describe('AsyncVirtualizedGrid.cy.ts', () => {
  it('single', () => {
    cy.mount(<AsyncVirtualizedGrid fetch={async () => ({items: [{id: 1}], count: 1})}/>);
  })
})
