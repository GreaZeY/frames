import { types as t } from '@babel/core';
import type { PluginObject, NodePath } from '@babel/core';

export default function framesBabelPlugin(): PluginObject {
  return {
    name: 'frames-jsx-compiler',
    visitor: {
      JSXFragment(path: NodePath<t.JSXFragment>) {
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
      JSXElement(path: NodePath<t.JSXElement>) {
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
                        // For reactive props, we use a getter: get prop() { return expr }
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
                    // Wrap dynamic children in a getter function so they are reactive
                    childrenExprs.push(t.arrowFunctionExpression([], childNode.expression as t.Expression));
                }
            }

            if (childrenExprs.length > 0) {
                const childrenValue = childrenExprs.length === 1 ? childrenExprs[0] : t.arrayExpression(childrenExprs);
                // Wrap children in a getter function so they execute INSIDE the component,
                // crucial for things like <Context.Provider> to set up state before children run.
                const lazyChildren = t.arrowFunctionExpression([], childrenValue);
                props.push(t.objectProperty(t.identifier("children"), lazyChildren));
            }

            const callExpr = t.callExpression(tagExpr!, [t.objectExpression(props)]);
            path.replaceWith(callExpr);
            return;
        }

        // --- Standard HTML Element Compilation ---
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
                        // Reactive property binding: effect(() => _el[attrName] = expr)
                        const updateExpr = t.assignmentExpression(
                            "=",
                            t.memberExpression(elVar, t.identifier(attrName)),
                            attrValue.expression as t.Expression
                        );
                        
                        statements.push(
                            t.expressionStatement(
                                t.callExpression(
                                    t.identifier("effect"),
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
                            t.identifier("insert"),
                            [elVar, childNode as unknown as t.Expression]
                        )
                    )
                );
            } else if (t.isJSXExpressionContainer(childNode)) {
                statements.push(
                    t.expressionStatement(
                        t.callExpression(
                            t.identifier("insert"),
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
