import {AsyncVirtualizedGrid} from "./lib/AsyncVirtualizedGrid/AsyncVirtualizedGrid";

const App = () => {
    return <div style={{height: 500, borderColor: 'black', borderStyle: 'solid'}}>
        <AsyncVirtualizedGrid
            fetch={async ({from, to}) => ({items: Array(to - from).fill(0).map((_, i) => ({id: from + i})), count: 1000})}
            rows={10}
        />
    </div>

};

export default App
