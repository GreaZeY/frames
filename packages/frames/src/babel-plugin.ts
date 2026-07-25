import { types as t } from '@babel/core';
import type { PluginObject, NodePath } from '@babel/core';

const PROP_ALIASES: Record<string, string> = {
    class: 'className',
    for: 'htmlFor',
};

const DIRECT_PROPS = new Set([
    'id', 'className', 'htmlFor', 'value', 'checked', 'disabled',
    'hidden', 'readOnly', 'required', 'selected', 'multiple',
    'textContent', 'innerHTML', 'tabIndex', 'draggable',
    'contentEditable', 'spellcheck', 'autofocus', 'placeholder',
    'src', 'href', 'alt', 'title', 'type', 'name', 'role',
]);

const NON_BUBBLING = new Set([
    'mouseenter', 'mouseleave', 'load', 'unload', 'scroll', 'focus', 'blur', 'error'
]);

function getRuntimeId(path: NodePath, state: any, name: string): t.Identifier {
    if (!state.framesRuntime) state.framesRuntime = {};
    if (!state.framesRuntime[name]) {
        const programPath = path.findParent(p => p.isProgram()) as NodePath<t.Program>;
        const id = programPath.scope.generateUidIdentifier(name);
        state.framesRuntime[name] = id;
        
        programPath.node.body.unshift(
            t.importDeclaration(
                [t.importSpecifier(id, t.identifier(name))],
                t.stringLiteral("frames")
            )
        );
    }
    return state.framesRuntime[name];
}

function resolveAttrName(raw: string): { prop: string; isDirect: boolean } {
    const mapped = PROP_ALIASES[raw] || raw;
    return { prop: mapped, isDirect: DIRECT_PROPS.has(mapped) };
}

type NamespacedJSXElement = t.JSXElement & { __framesSvg?: boolean };

function markSvgTree(element: NamespacedJSXElement, inheritedSvg: boolean) {
    const name = t.isJSXIdentifier(element.openingElement.name)
        ? element.openingElement.name.name
        : '';
    const isSvg = name === 'svg' || inheritedSvg;
    element.__framesSvg = isSvg;

    const childSvg = isSvg && name !== 'foreignObject';
    for (const child of element.children) {
        if (t.isJSXElement(child)) {
            markSvgTree(child as NamespacedJSXElement, childSvg);
        }
    }
}

export default function framesBabelPlugin(): PluginObject {
  return {
    name: 'frames-jsx-compiler',
    visitor: {
      JSXFragment(path: NodePath<t.JSXFragment>, state: any) {
        const childrenExprs: t.Expression[] = [];
        for (let childPath of path.get('children')) {
            const childNode = childPath.node;
            if (t.isJSXText(childNode)) {
                const text = childNode.value.trim();
                if (text) {
                    childrenExprs.push(t.stringLiteral(text));
                }
            } else if (t.isJSXElement(childNode) || t.isJSXFragment(childNode)) {
                childrenExprs.push(childNode as unknown as t.Expression);
            } else if (
                t.isJSXExpressionContainer(childNode) &&
                !t.isJSXEmptyExpression(childNode.expression)
            ) {
                childrenExprs.push(t.arrowFunctionExpression([], childNode.expression as t.Expression));
            }
        }
        path.replaceWith(t.arrayExpression(childrenExprs));
      },
      JSXElement(path: NodePath<t.JSXElement>, state: any) {
        const openingElement = path.node.openingElement;
        const element = path.node as NamespacedJSXElement;
        if (element.__framesSvg == null) markSvgTree(element, false);
        
        let tagName = "";
        let tagExpr: t.Expression;
        
        if (t.isJSXIdentifier(openingElement.name)) {
            tagName = openingElement.name.name;
            tagExpr = t.identifier(tagName);
        } else if (t.isJSXMemberExpression(openingElement.name)) {
            const obj = openingElement.name.object;
            const prop = openingElement.name.property;
            if (t.isJSXIdentifier(obj) && t.isJSXIdentifier(prop)) {
                tagName = `${obj.name}.${prop.name}`;
                tagExpr = t.memberExpression(t.identifier(obj.name), t.identifier(prop.name));
            } else {
                return;
            }
        } else {
            return;
        }
        
        const isComponent = /^[A-Z]/.test(tagName);

        if (isComponent) {
            const props: (t.ObjectProperty | t.SpreadElement)[] = [];

            for (const attr of openingElement.attributes) {
                if (t.isJSXSpreadAttribute(attr)) {
                    props.push(t.spreadElement(attr.argument));
                } else if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                    const attrName = attr.name.name;
                    const attrValue = attr.value;
                    const attrKey = () => t.isValidIdentifier(attrName)
                        ? t.identifier(attrName)
                        : t.stringLiteral(attrName);

                    if (attrValue == null) {
                        props.push(t.objectProperty(attrKey(), t.booleanLiteral(true)));
                    } else if (t.isStringLiteral(attrValue)) {
                        props.push(t.objectProperty(attrKey(), attrValue));
                    } else if (t.isJSXExpressionContainer(attrValue)) {
                        const getter = t.objectMethod(
                            "get",
                            attrKey(),
                            [],
                            t.blockStatement([t.returnStatement(attrValue.expression as t.Expression)])
                        );
                        props.push(getter as any);
                    }
                }
            }

            const childrenExprs: t.Expression[] = [];
            for (let childPath of path.get('children')) {
                const childNode = childPath.node;
                if (t.isJSXText(childNode)) {
                    const text = childNode.value.trim();
                    if (text) {
                        childrenExprs.push(t.stringLiteral(text));
                    }
                } else if (t.isJSXElement(childNode) || t.isJSXFragment(childNode)) {
                    childrenExprs.push(childNode as unknown as t.Expression);
                } else if (
                    t.isJSXExpressionContainer(childNode) &&
                    !t.isJSXEmptyExpression(childNode.expression)
                ) {
                    childrenExprs.push(t.arrowFunctionExpression([], childNode.expression as t.Expression));
                }
            }

            if (childrenExprs.length > 0) {
                const childrenValue = childrenExprs.length === 1 ? childrenExprs[0] : t.arrayExpression(childrenExprs);
                const lazyChildren = t.arrowFunctionExpression([], childrenValue);
                props.push(t.objectProperty(t.identifier("children"), lazyChildren));
            }

            const callExpr = t.callExpression(tagExpr!, [t.objectExpression(props)]);
            path.replaceWith(callExpr);
            return;
        }

        const insertId = getRuntimeId(path, state, "insert");
        const effectId = getRuntimeId(path, state, "effect");
        const bindEventId = getRuntimeId(path, state, "bindEvent");
        const setPropertyId = getRuntimeId(path, state, "setProperty");

        const elVar = path.scope.generateUidIdentifier("el");
        const exprs: t.Expression[] = [];
        const hasSpread = openingElement.attributes.some(t.isJSXSpreadAttribute);

        const scopeBlock = path.scope.getBlockParent();
        (scopeBlock as any).push({ id: t.cloneNode(elVar), init: null, kind: 'var' as const });
        
        exprs.push(
            t.assignmentExpression(
                "=",
                t.cloneNode(elVar),
                element.__framesSvg
                    ? t.callExpression(
                        t.memberExpression(t.identifier("document"), t.identifier("createElementNS")),
                        [t.stringLiteral('http://www.w3.org/2000/svg'), t.stringLiteral(tagName)]
                    )
                    : t.callExpression(
                        t.memberExpression(t.identifier("document"), t.identifier("createElement")),
                        [t.stringLiteral(tagName)]
                    )
            )
        );

        if (hasSpread) {
            const setPropertiesId = getRuntimeId(path, state, "setProperties");
            const properties: (t.ObjectProperty | t.SpreadElement)[] = [];

            for (const attr of openingElement.attributes) {
                if (t.isJSXSpreadAttribute(attr)) {
                    properties.push(t.spreadElement(attr.argument));
                } else if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && !attr.name.name.startsWith('on')) {
                    const value = attr.value == null
                        ? t.booleanLiteral(true)
                        : t.isStringLiteral(attr.value)
                            ? attr.value
                            : t.isJSXExpressionContainer(attr.value)
                                ? attr.value.expression as t.Expression
                                : t.nullLiteral();
                    properties.push(t.objectProperty(t.stringLiteral(attr.name.name), value));
                }
            }

            exprs.push(t.callExpression(effectId, [
                t.arrowFunctionExpression([], t.callExpression(setPropertiesId, [
                    t.cloneNode(elVar),
                    t.objectExpression(properties),
                ])),
            ]));
        }

        for (const attr of openingElement.attributes) {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const attrName = attr.name.name;
                const attrValue = attr.value;

                if (hasSpread && !attrName.startsWith('on')) continue;

                if (attrName === 'ref' && t.isJSXExpressionContainer(attrValue)) {
                    const bindRefId = getRuntimeId(path, state, "bindRef");
                    exprs.push(t.callExpression(bindRefId, [
                        t.cloneNode(elVar),
                        t.arrowFunctionExpression([], attrValue.expression as t.Expression),
                    ]));
                    continue;
                }

                if (attrValue == null) {
                    exprs.push(t.callExpression(setPropertyId, [
                        t.cloneNode(elVar),
                        t.stringLiteral(attrName),
                        t.booleanLiteral(true),
                    ]));
                } else if (t.isStringLiteral(attrValue)) {
                    const { prop, isDirect } = resolveAttrName(attrName);
                    if (isDirect && !element.__framesSvg) {
                        exprs.push(
                            t.assignmentExpression(
                                "=",
                                t.memberExpression(t.cloneNode(elVar), t.identifier(prop)),
                                attrValue
                            )
                        );
                    } else {
                        exprs.push(t.callExpression(setPropertyId, [
                            t.cloneNode(elVar),
                            t.stringLiteral(attrName),
                            attrValue,
                        ]));
                    }
                } else if (t.isJSXExpressionContainer(attrValue)) {
                    if (attrName.startsWith('on')) {
                        const eventName = attrName.toLowerCase().substring(2);
                        exprs.push(t.callExpression(bindEventId, [
                            t.cloneNode(elVar),
                            t.stringLiteral(eventName),
                            t.arrowFunctionExpression([], attrValue.expression as t.Expression),
                            t.booleanLiteral(!NON_BUBBLING.has(eventName)),
                        ]));
                    } else {
                        exprs.push(
                            t.callExpression(
                                effectId,
                                [t.arrowFunctionExpression([], t.callExpression(setPropertyId, [
                                    t.cloneNode(elVar),
                                    t.stringLiteral(attrName),
                                    attrValue.expression as t.Expression,
                                ]))]
                            )
                        );
                    }
                }
            }
        }
        
        for (let childPath of path.get('children')) {
            const childNode = childPath.node;
            
            if (t.isJSXText(childNode)) {
                const text = childNode.value.trim();
                if (text) {
                    exprs.push(
                        t.callExpression(
                            t.memberExpression(t.cloneNode(elVar), t.identifier("appendChild")),
                            [
                                t.callExpression(
                                    t.memberExpression(t.identifier("document"), t.identifier("createTextNode")),
                                    [t.stringLiteral(text)]
                                )
                            ]
                        )
                    );
                }
            } else if (t.isJSXElement(childNode) || t.isJSXFragment(childNode)) {
                exprs.push(
                    t.callExpression(
                        insertId,
                        [t.cloneNode(elVar), childNode as unknown as t.Expression]
                    )
                );
            } else if (
                t.isJSXExpressionContainer(childNode) &&
                !t.isJSXEmptyExpression(childNode.expression)
            ) {
                exprs.push(
                    t.callExpression(
                        insertId,
                        [
                            t.cloneNode(elVar),
                            t.arrowFunctionExpression([], childNode.expression as t.Expression)
                        ]
                    )
                );
            }
        }
        
        exprs.push(t.cloneNode(elVar));
        
        path.replaceWith(t.sequenceExpression(exprs));
      }
    }
  };
}
