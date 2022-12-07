import React from "react";
import {Simulate} from "react-dom/test-utils";
import load = Simulate.load;

export type Fetch<T> = (({from, to}: { from: number, to: number }) => Promise<{ items: T[], count: number }>)

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 4;
const DEFAULT_HEIGHT = 100;
const ITEMS_PER_PAGE = 10;

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

type Loadable<T, E> =
// the request is loading
    | { status: "loading" }
    // the request successfully completed
    | { status: "complete", value: T }
    // the request completed with an error
    | { status: "error", error: E }

type Data<T extends { id: string | number; }> = {
    // the number of items the server has. undefined if we haven't fetched it yet.
    count: undefined | number,
    // the pages we have requested. May still be loading. The key is the `from` field of the page request.
    // there can be no two keys within `ITEMS_PER_PAGE` of each other.
    pages: Record<number, Loadable<T[], unknown>>
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

    const [currentlyInView, setCurrentlyInView] = React.useState({from: 0, to: ITEMS_PER_PAGE})

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

    const calcBottomFakeHeight = React.useCallback((count: number) => {
        return ((count - currentlyInView.to) / columns) * height
    }, [currentlyInView.to, height, columns])

    const topFakeHeight = React.useMemo(() => {
        return (currentlyInView.from / columns) * height
    }, [currentlyInView.from, height, columns])

    const [data, setData] = React.useState<Data<T>>({
        count: undefined,
        pages: {}
    });

    const loadData = React.useCallback(() => {
        setData(({count, pages}) => ({count, pages: {...pages, [currentlyInView.from]: {status: "loading"}}}))
        fetch(currentlyInView)
            .then(({count, items}) => {
                    setData(({pages}) => ({
                        count: count,
                        pages: {...pages, [currentlyInView.from]: {status: "complete", value: items}}
                    }));
                }
            )
            .catch(error => setData(({count, pages}) => ({
                count,
                pages: {...pages, [currentlyInView.from]: {status: "error", error}}
            })))
    }, [setData, fetch, currentlyInView]);

    React.useEffect(() => {
        // when load data changes we no longer know how large the page is. reset everything.
        setData({count: undefined, pages: {}})
        loadData();
    }, [loadData]);

    // if we do not know the count - we cannot measure the size of anything. so we need to wait for the count.
    const count = data.count;
    if (count === undefined) {
        return <CountLoading/>
    }

    const bottomFakeHeight = calcBottomFakeHeight(count);

    return <div style={{overflowY: "scroll", height: '100%', display: "flex", flexDirection: "row"}} onScroll={(event) => handleScroll(count, currentlyInView, event)}>
        <div role={"presentation"} style={{height: topFakeHeight}}/>
        {
            Object
                .keys(data.pages)
                .map(it => parseInt(it, 10))
                .flatMap(from => {
                    console.log("rendering page", from, currentlyInView)
                    if (from >= currentlyInView.from && from < currentlyInView.to) {
                        const newVar = [data.pages[from]];
                        console.log(newVar)
                        return newVar
                    } else {
                        return []
                    }
                }).map(loadable => {
                switch (loadable.status) {
                    case "loading":
                        return <div style={{height: (ITEMS_PER_PAGE / columns) * height}}>Loading...</div>
                    case "error":
                        return <div style={{height: (ITEMS_PER_PAGE / columns) * height}}>Error...</div>
                    case "complete":
                        return <div style={{height: (ITEMS_PER_PAGE / columns) * height}}>{JSON.stringify(loadable.value)}</div>
                    default:
                        return loadable;
                }
            })
        }
        <div role={"presentation"} style={{height: bottomFakeHeight}}/>
    </div>
}

const renderRowBase = <T extends { id: string | number; }, >(items: T[], style: React.CSSProperties, renderCell: (item: T) => React.ReactNode): React.ReactNode =>
    <div style={style} key={items.reduce((acc, item) => acc + item.id.toString(), "row:")}>
        {items.map(renderCell)}
    </div>

const renderCellBase = <T extends { id: string | number; }, >(item: T, style: React.CSSProperties): React.ReactNode =>
    <div style={style} key={"item" + item.id}>{JSON.stringify(item)}</div>