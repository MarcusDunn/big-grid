import React from "react";

export type Fetch<T> =
// fetch the count and items with the same request
    | (({from, to}: { from: number, to: number }) => Promise<{ items: T[], count: number }>)

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 4;
const DEFAULT_HEIGHT = 100;

// allows injecting styles into a row.
export type RenderRow<T extends { id: string | number; }> = (
    render: (
        items: T[],
        style: React.CSSProperties,
        renderCell: (item: T) => React.ReactNode
    ) => React.ReactNode,
    items: T[],
    style: React.CSSProperties,
    renderCell: (item: T) => React.ReactNode
) => React.ReactNode;

// allows injecting styles into a cell.
export type RenderCell<T extends { id: string | number; }> = (
    render: (item: T, style: React.CSSProperties) => React.ReactNode,
    item: T,
    style: React.CSSProperties
) => React.ReactNode;

export type AsyncVirtualizedGridProps<T extends { id: number | string }, > = {
    /// how to fetch the data and count
    fetch: Fetch<T>;
    /// the number of rows per page. defaults to DEFAULT_ROWS
    rows?: number,
    /// the number of rows per page. defaults to DEFAULT_COLUMNS
    columns?: number,
    /// the height of each row. defaults to DEFAULT_HEIGHT
    height?: number,
    /// how to render each row. defaults to calling defaultRender immediately.
    renderRow?: RenderRow<T>,
    /// how to render each row. defaults to calling defaultRender immediately.
    renderCell?: RenderCell<T>,
    /// what to render when the count is loading. defaults to some text.
    CountLoading?: React.FC,
    /// what to render when fetching count fails. defaults to some text.
    CountError?: React.FC<{ error: unknown, reportError: NonNullable<AsyncVirtualizedGridProps<T>["reportError"]> }>
    /// where to report an error to. defaults to console.error
    reportError?: (error: unknown) => void,
    // how many pixels to allow rendering outside the viewport. defaults to 200.
    padding?: number,
};


export const AsyncVirtualizedGrid = <T extends { id: string | number; }, >({
                                                                               fetch,
                                                                               rows = DEFAULT_ROWS,
                                                                               columns = DEFAULT_COLUMNS,
                                                                               height = DEFAULT_HEIGHT,
                                                                               renderRow = (defaultRender, items, style, renderCell) => defaultRender(items, style, renderCell),
                                                                               renderCell = (defaultRender, item, style) => defaultRender(item, style),
                                                                               CountLoading = () => <div>Loading
                                                                                   count...</div>,
                                                                               reportError = (error) => console.error(error),
                                                                               CountError = ({error, reportError}) => {
                                                                                   reportError(error);
                                                                                   return <div>Count Error</div>
                                                                               },
                                                                               padding = 200,
                                                                           }: AsyncVirtualizedGridProps<T>): ReturnType<React.FC> => {

    const [currentlyInView, setCurrentlyInView] = React.useState({from: 0, to: rows * columns})

    const handleScroll = React.useCallback((count: number, {
        from,
        to
    }: { from: number, to: number }, event: React.UIEvent<HTMLDivElement>) => {
        console.log("scrolling")
        const {scrollTop, clientHeight} = event.currentTarget
        // the top of the currently rendered content (0 is the top)
        const renderedTop = (from / columns) * height;
        // the bottom of the currently rendered content
        const renderedBottom = (to / columns) * height;
        // the top of the current viewport (0 is the top) minus padding
        const inViewTop = Math.max(0, scrollTop - padding);
        // the bottom of the current viewport plus padding
        const inViewBottom = Math.min((count / columns) * height, scrollTop + clientHeight + padding)
        // if the top of the viewport is below the top of the rendered content
        console.log({scrollTop, clientHeight, renderedTop, renderedBottom, inViewTop, inViewBottom})
        if (inViewTop > renderedTop) {
            // we should render fewer items above
            console.log("we should be rendering less at the top!")
            setCurrentlyInView(({
                                    to: oldTo
                                }) => ({from: Math.max(0, Math.floor((inViewTop * columns) / height)), to: oldTo}));
        }
        // if the bottom of the viewport is above the bottom of the rendered content
        if (inViewBottom < renderedBottom) {
            // we should render fewer items at the bottom
            console.log("we should be rendering less at the bottom!")
            setCurrentlyInView(({
                                    from: oldFrom,
                                }) => ({
                from: oldFrom,
                to: Math.min(count, Math.ceil((inViewBottom * columns) / height))
            }));
        }
        // if the top of the viewport is above the top of the rendered content
        if (inViewTop < renderedTop) {
            // we should render more items above
            console.log("we should be rendering more at the top!")
            setCurrentlyInView(({
                                    to: oldTo,
                                }) => ({
                from: Math.max(0, Math.floor((inViewTop * columns) / height)),
                to: oldTo
            }));
        }
        // if the bottom of the viewport is below the bottom of the rendered content
        if (inViewBottom > renderedBottom) {
            // we should render more items at the below
            console.log("we should be rendering more at the bottom!")
            setCurrentlyInView(({
                                    from: oldFrom,
                                }) => ({
                from: oldFrom,
                to: Math.min(count, Math.ceil((inViewBottom * columns) / height))
            }));
        }
    }, [setCurrentlyInView, padding])

    React.useEffect(() => {
        console.log(currentlyInView);
    }, [currentlyInView])

    const bottomFakeHeight = React.useCallback((count: number) => {
        return ((count - currentlyInView.to) / columns) * height
    }, [currentlyInView.from, height, columns])

    const topFakeHeight = React.useMemo(() => {
        return (currentlyInView.from / columns) * height
    }, [currentlyInView.from, height, columns])

    const [data, setData] = React.useState<| { status: 'loading' }
        | { status: 'not requested' }
        | { status: 'loaded', data: { items: { [p: number]: T }; count: number } }
        | { status: 'error', error: unknown }>({status: 'not requested'});

    const loadData = React.useCallback(() => {
        fetch(currentlyInView)
            .then(({count, items}) => {
                    setData(old => ({
                        status: 'loaded',
                        data: {
                            count, items: items.reduce((acc, item, i) => ({...acc, [i + currentlyInView.from]: item}), old)
                        }
                    }));
                }
            )
            .catch(error => setData({status: "error", error: error}))
    }, [setData, fetch, currentlyInView]);

    React.useEffect(() => {
        setData({status: 'loading'});
        loadData();
    }, [loadData]);

    switch (data.status) {
        case "loading":
            return <CountLoading/>;
        case "not requested":
            return <CountLoading/>;
        case "loaded":
            const array = Array(currentlyInView.to - currentlyInView.from)
                .fill(0)
                .map((_, i) => currentlyInView.from + i)
            if (array.some(i => data.data.items[i] === undefined)) {
                console.log("loading more data")
                loadData();
                return <CountLoading/>
            }
            console.log("about to render: ", currentlyInView)
            return <div style={{overflowY: "scroll", width: "100%", height: "100%"}}
                        onScroll={event => handleScroll(data.data.count, currentlyInView, event)}>
                <div role={"presentation"} style={{height: topFakeHeight}}/>
                {array
                    .filter(i => i % columns == 0)
                    .reduce((acc, i) => [...acc, array.slice(i, i + columns).map(j => data.data.items[j])], [] as T[][])
                    .map(row => renderRow(renderRowBase, row, {
                        display: "flex",
                        height: height
                    }, item => renderCell(renderCellBase, item, {})))}
                <div role={"presentation"}
                     style={{height: bottomFakeHeight(data.data.count)}}/>
            </div>
        case "error":
            return <CountError error={data.error} reportError={reportError}/>
        default:
            return data
    }
}

const renderRowBase = <T extends { id: string | number; }, >(items: T[], style: React.CSSProperties, renderCell: (item: T) => React.ReactNode): React.ReactNode =>
    <div style={style} key={items.reduce((acc, item) => acc + item.id.toString(), "row:")}>
        {items.map(renderCell)}
    </div>

const renderCellBase = <T extends { id: string | number; }, >(item: T, style: React.CSSProperties): React.ReactNode =>
    <div style={style} key={"item" + item.id}>{JSON.stringify(item)}</div>