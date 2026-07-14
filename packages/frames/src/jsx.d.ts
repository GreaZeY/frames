declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: any;
    }
    type Element = any;
    interface ElementClass {}
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
}
