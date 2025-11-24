import os
import json
from pathlib import Path

# Base path for generated components
BASE_PATH = Path(__file__).parent.parent.parent / "generated"
COMPONENTS_PATH = BASE_PATH / "components"
PAGES_PATH = BASE_PATH / "pages"

# Ensure directories exist
COMPONENTS_PATH.mkdir(parents=True, exist_ok=True)
PAGES_PATH.mkdir(parents=True, exist_ok=True)


def create_component(name: str, code: str) -> dict:
    """
    Create a new React component file.

    Args:
        name: Component name (e.g., 'Button', 'Card')
        code: The complete React component code

    Returns:
        dict: Status and filepath of created component
    """
    try:
        # Validate component name
        if not name or not name[0].isupper():
            return {
                "status": "error",
                "message": "Component name must start with an uppercase letter"
            }

        # Validate that code looks like actual code, not explanatory text
        code_lower = code.lower()
        # Check for signs this is explanatory text rather than code
        if any(phrase in code_lower for phrase in ['here is', 'i have created', 'i\'ve created', 'this component', '## ']):
            return {
                "status": "error",
                "message": "The 'code' parameter should contain only the actual component code, not explanatory text. Please provide just the TypeScript/React code."
            }

        # Check for minimum code patterns (function/const component)
        if 'function' not in code_lower and 'const' not in code_lower and '=>' not in code:
            return {
                "status": "error",
                "message": "The code doesn't appear to contain a valid React component. Please provide complete component code."
            }

        # Create filepath
        filepath = COMPONENTS_PATH / f"{name}.tsx"

        # Check if component already exists
        if filepath.exists():
            return {
                "status": "error",
                "message": f"Component '{name}' already exists. Use update_component to modify it."
            }

        # Write component file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)

        return {
            "status": "success",
            "filepath": str(filepath),
            "component_name": name,
            "message": f"Component '{name}' created successfully"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to create component: {str(e)}"
        }


def update_component(name: str, code: str) -> dict:
    """
    Update an existing React component file.

    Args:
        name: Component name to update
        code: The updated React component code

    Returns:
        dict: Status and filepath of updated component
    """
    try:
        # Validate that code looks like actual code, not explanatory text
        code_lower = code.lower()
        if any(phrase in code_lower for phrase in ['here is', 'i have updated', 'i\'ve updated', 'the updated', '## ']):
            return {
                "status": "error",
                "message": "The 'code' parameter should contain only the actual component code, not explanatory text. Please provide just the TypeScript/React code."
            }

        # Check for minimum code patterns
        if 'function' not in code_lower and 'const' not in code_lower and '=>' not in code:
            return {
                "status": "error",
                "message": "The code doesn't appear to contain a valid React component. Please provide complete component code."
            }

        filepath = COMPONENTS_PATH / f"{name}.tsx"

        if not filepath.exists():
            return {
                "status": "error",
                "message": f"Component '{name}' not found. Use create_component to create it."
            }

        # Write updated component file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)

        return {
            "status": "success",
            "filepath": str(filepath),
            "component_name": name,
            "message": f"Component '{name}' updated successfully"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to update component: {str(e)}"
        }


def read_component(name: str) -> dict:
    """
    Read an existing React component file.

    Args:
        name: Component name to read

    Returns:
        dict: Status and content of the component
    """
    try:
        filepath = COMPONENTS_PATH / f"{name}.tsx"

        if not filepath.exists():
            return {
                "status": "error",
                "message": f"Component '{name}' not found"
            }

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        return {
            "status": "success",
            "component_name": name,
            "content": content,
            "filepath": str(filepath)
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to read component: {str(e)}"
        }


def list_components() -> dict:
    """
    List all generated React components.

    Returns:
        dict: Status and list of component names
    """
    try:
        components = []

        for filepath in COMPONENTS_PATH.glob("*.tsx"):
            component_name = filepath.stem
            components.append({
                "name": component_name,
                "filepath": str(filepath)
            })

        return {
            "status": "success",
            "components": components,
            "count": len(components)
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to list components: {str(e)}"
        }


def create_page(page_name: str, layout_data: str) -> dict:
    """
    Create a page file that imports and arranges components according to layout data.

    Args:
        page_name: Name of the page to create
        layout_data: JSON string containing component layout information

    Returns:
        dict: Status and filepath of created page
    """
    try:
        # Parse layout data
        layout = json.loads(layout_data)

        # Generate imports
        imports = set()
        for item in layout.get('components', []):
            comp_name = item.get('componentName')
            if comp_name:
                imports.add(comp_name)

        # Collect all state variables and handlers from interactions
        all_state_vars = {}  # name -> {type, initialValue}
        all_handlers = {}  # component_id -> list of handlers

        for item in layout.get('components', []):
            interactions = item.get('interactions', [])
            component_id = item.get('id')

            if interactions:
                all_handlers[component_id] = []

            for interaction in interactions:
                # Collect state variables
                state_vars = interaction.get('state', [])
                for state_var in state_vars:
                    var_name = state_var.get('name')
                    if var_name and var_name not in all_state_vars:
                        all_state_vars[var_name] = {
                            'type': state_var.get('type', 'any'),
                            'initialValue': state_var.get('initialValue')
                        }

                # Store handler info
                if component_id:
                    all_handlers[component_id].append({
                        'type': interaction.get('type'),
                        'handlerName': interaction.get('handlerName'),
                        'code': interaction.get('code')
                    })

        # Build page code
        code_lines = [
            "import { useState } from 'react';",
            "",
            "// Component imports - these are generated components from /generated/components/",
            "// Make sure the component files exist in the ../components/ directory",
        ]

        # Add component imports
        for comp_name in sorted(imports):
            code_lines.append(f"import {comp_name} from '../components/{comp_name}';")

        code_lines.extend([
            "",
            f"export default function {page_name}() {{",
        ])

        # Add state declarations
        if all_state_vars:
            code_lines.append("  // State management")
            for var_name, var_info in all_state_vars.items():
                initial_val = json.dumps(var_info['initialValue'])
                setter_name = 'set' + var_name[0].upper() + var_name[1:]
                code_lines.append(f"  const [{var_name}, {setter_name}] = useState({initial_val});")
            code_lines.append("")

        # Add event handlers
        if all_handlers:
            code_lines.append("  // Event handlers")
            for component_id, handlers in all_handlers.items():
                for handler in handlers:
                    # Clean up the handler code (remove const declaration if present)
                    handler_code = handler['code']
                    # Add proper indentation
                    handler_lines = handler_code.split('\n')
                    for line in handler_lines:
                        code_lines.append(f"  {line}")
            code_lines.append("")

        # Return statement
        code_lines.extend([
            "  return (",
            "    <div className=\"relative w-full min-h-screen bg-gray-50\">",
        ])

        # Add positioned components with their event handlers
        for item in layout.get('components', []):
            comp_name = item.get('componentName')
            component_id = item.get('id')
            position = item.get('position', {})
            size = item.get('size', {})
            x = position.get('x', 0)
            y = position.get('y', 0)
            width = size.get('width')
            height = size.get('height')

            # Build style object
            style_parts = [f"left: {x}", f"top: {y}"]
            if width:
                style_parts.append(f"width: {width}")
            if height:
                style_parts.append(f"height: {height}")
            style_str = ", ".join(style_parts)

            # Collect props (event handlers)
            props = []
            if component_id in all_handlers:
                for handler in all_handlers[component_id]:
                    event_type = handler['type']
                    handler_name = handler['handlerName']
                    props.append(f"{event_type}={{{handler_name}}}")

            props_str = ' '.join(props)
            if props_str:
                props_str = ' ' + props_str

            code_lines.extend([
                f"      <div className=\"absolute\" style={{{{ {style_str} }}}}>",
                f"        <{comp_name}{props_str} />",
                "      </div>",
            ])

        code_lines.extend([
            "    </div>",
            "  );",
            "}",
            ""
        ])

        page_code = "\n".join(code_lines)

        # Write page file
        filepath = PAGES_PATH / f"{page_name}.tsx"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(page_code)

        return {
            "status": "success",
            "filepath": str(filepath),
            "page_name": page_name,
            "code": page_code,
            "message": f"Page '{page_name}' created successfully"
        }

    except json.JSONDecodeError:
        return {
            "status": "error",
            "message": "Invalid layout data JSON"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to create page: {str(e)}"
        }


# Tool definitions for Claude API
TOOLS = [
    {
        "name": "create_component",
        "description": "Create a new React TypeScript component file with Tailwind CSS styling. The component should be a functional component with proper TypeScript types and Tailwind classes for styling.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Component name in PascalCase (e.g., 'Button', 'PricingCard', 'HeroSection')"
                },
                "code": {
                    "type": "string",
                    "description": "The complete React TypeScript component code including imports, types, and export"
                }
            },
            "required": ["name", "code"]
        }
    },
    {
        "name": "update_component",
        "description": "Update an existing React component file with new code.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the component to update"
                },
                "code": {
                    "type": "string",
                    "description": "The updated React component code"
                }
            },
            "required": ["name", "code"]
        }
    },
    {
        "name": "read_component",
        "description": "Read the code of an existing React component.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the component to read"
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "list_components",
        "description": "List all available React components that have been generated.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]


def process_tool_call(tool_name: str, tool_input: dict) -> dict:
    """
    Execute a tool call and return the result.

    Args:
        tool_name: Name of the tool to execute
        tool_input: Input parameters for the tool

    Returns:
        dict: Result of the tool execution
    """
    if tool_name == "create_component":
        return create_component(tool_input["name"], tool_input["code"])
    elif tool_name == "update_component":
        return update_component(tool_input["name"], tool_input["code"])
    elif tool_name == "read_component":
        return read_component(tool_input["name"])
    elif tool_name == "list_components":
        return list_components()
    else:
        return {
            "status": "error",
            "message": f"Unknown tool: {tool_name}"
        }
