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
            } else if (t.isJSXExpressionContainer(childNode)) {
                childrenExprs.push(t.arrowFunctionExpression([], childNode.expression as t.Expression));
            }
        }
        path.replaceWith(t.arrayExpression(childrenExprs));
      },
      JSXElement(path: NodePath<t.JSXElement>, state: any) {
        const openingElement = path.node.openingElement;
        
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
            const props: t.ObjectProperty[] = [];

            for (const attr of openingElement.attributes) {
                if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                    const attrName = attr.name.name;
                    const attrValue = attr.value;

                    if (t.isStringLiteral(attrValue)) {
                        props.push(t.objectProperty(t.identifier(attrName), attrValue));
                    } else if (t.isJSXExpressionContainer(attrValue)) {
                        const getter = t.objectMethod(
                            "get",
                            t.identifier(attrName),
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
                } else if (t.isJSXExpressionContainer(childNode)) {
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
        const delegateId = getRuntimeId(path, state, "delegateEvent");

        const elVar = path.scope.generateUidIdentifier("el");
        const exprs: t.Expression[] = [];

        const scopeBlock = path.scope.getBlockParent();
        (scopeBlock as any).push({ id: t.cloneNode(elVar), init: null, kind: 'var' as const });
        
        exprs.push(
            t.assignmentExpression(
                "=",
                t.cloneNode(elVar),
                t.callExpression(
                    t.memberExpression(t.identifier("document"), t.identifier("createElement")),
                    [t.stringLiteral(tagName)]
                )
            )
        );
        
        for (const attr of openingElement.attributes) {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const attrName = attr.name.name;
                const attrValue = attr.value;
                
                if (t.isStringLiteral(attrValue)) {
                    const { prop, isDirect } = resolveAttrName(attrName);
                    if (isDirect) {
                        exprs.push(
                            t.assignmentExpression(
                                "=",
                                t.memberExpression(t.cloneNode(elVar), t.identifier(prop)),
                                attrValue
                            )
                        );
                    } else {
                        exprs.push(
                            t.callExpression(
                                t.memberExpression(t.cloneNode(elVar), t.identifier("setAttribute")),
                                [t.stringLiteral(attrName), attrValue]
                            )
                        );
                    }
                } else if (t.isJSXExpressionContainer(attrValue)) {
                    if (attrName.startsWith('on')) {
                        const eventName = attrName.toLowerCase().substring(2);
                        if (NON_BUBBLING.has(eventName)) {
                            // Non-bubbling events attach directly
                            exprs.push(
                                t.callExpression(
                                    t.memberExpression(t.cloneNode(elVar), t.identifier("addEventListener")),
                                    [t.stringLiteral(eventName), attrValue.expression as t.Expression]
                                )
                            );
                        } else {
                            // Bubbling events use global delegation
                            exprs.push(
                                t.assignmentExpression(
                                    "=",
                                    t.memberExpression(t.cloneNode(elVar), t.identifier(`$$${eventName}`)),
                                    attrValue.expression as t.Expression
                                )
                            );
                            exprs.push(
                                t.callExpression(delegateId, [t.stringLiteral(eventName)])
                            );
                        }
                    } else {
                        const { prop } = resolveAttrName(attrName);
                        const updateExpr = t.assignmentExpression(
                            "=",
                            t.memberExpression(t.cloneNode(elVar), t.identifier(prop)),
                            attrValue.expression as t.Expression
                        );
                        
                        exprs.push(
                            t.callExpression(
                                effectId,
                                [t.arrowFunctionExpression([], updateExpr)]
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
            } else if (t.isJSXExpressionContainer(childNode)) {
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
