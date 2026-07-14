import { types as t } from '@babel/core';
import type { PluginObject, NodePath } from '@babel/core';

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
            // Compile to Component({ props })
            const props: t.ObjectProperty[] = [];

            // 1. Attributes -> Props
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

            // 2. Children -> children prop
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

        // --- Standard HTML Element Compilation ---
        const insertId = getRuntimeId(path, state, "insert");
        const effectId = getRuntimeId(path, state, "effect");

        const statements: t.Statement[] = [];
        const elVar = path.scope.generateUidIdentifier("el");
        
        statements.push(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              elVar,
              t.callExpression(
                t.memberExpression(t.identifier("document"), t.identifier("createElement")),
                [t.stringLiteral(tagName)]
              )
            )
          ])
        );
        
        for (const attr of openingElement.attributes) {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const attrName = attr.name.name;
                const attrValue = attr.value;
                
                if (t.isStringLiteral(attrValue)) {
                    statements.push(
                        t.expressionStatement(
                            t.callExpression(
                                t.memberExpression(elVar, t.identifier("setAttribute")),
                                [t.stringLiteral(attrName), attrValue]
                            )
                        )
                    );
                } else if (t.isJSXExpressionContainer(attrValue)) {
                    if (attrName.startsWith('on')) {
                        const eventName = attrName.toLowerCase().substring(2);
                        statements.push(
                            t.expressionStatement(
                                t.callExpression(
                                    t.memberExpression(elVar, t.identifier("addEventListener")),
                                    [t.stringLiteral(eventName), attrValue.expression as t.Expression]
                                )
                            )
                        );
                    } else {
                        const updateExpr = t.assignmentExpression(
                            "=",
                            t.memberExpression(elVar, t.identifier(attrName)),
                            attrValue.expression as t.Expression
                        );
                        
                        statements.push(
                            t.expressionStatement(
                                t.callExpression(
                                    effectId,
                                    [t.arrowFunctionExpression([], updateExpr)]
                                )
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
                    statements.push(
                        t.expressionStatement(
                            t.callExpression(
                                t.memberExpression(elVar, t.identifier("appendChild")),
                                [
                                    t.callExpression(
                                        t.memberExpression(t.identifier("document"), t.identifier("createTextNode")),
                                        [t.stringLiteral(text)]
                                    )
                                ]
                            )
                        )
                    );
                }
            } else if (t.isJSXElement(childNode) || t.isJSXFragment(childNode)) {
                statements.push(
                    t.expressionStatement(
                        t.callExpression(
                            insertId,
                            [elVar, childNode as unknown as t.Expression]
                        )
                    )
                );
            } else if (t.isJSXExpressionContainer(childNode)) {
                statements.push(
                    t.expressionStatement(
                        t.callExpression(
                            insertId,
                            [
                                elVar,
                                t.arrowFunctionExpression([], childNode.expression as t.Expression)
                            ]
                        )
                    )
                );
            }
        }
        
        statements.push(t.returnStatement(elVar));
        
        path.replaceWith(
            t.callExpression(
                t.arrowFunctionExpression([], t.blockStatement(statements)),
                []
            )
        );
      }
    }
  };
}
