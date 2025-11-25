import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv
from .tools import TOOLS, process_tool_call, create_page

# Load environment variables
load_dotenv()

# Initialize Anthropic client
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def edit_component_streaming(component_name: str, edit_description: str):
    """
    Use Claude to edit an existing React component with streaming progress.

    Yields progress events as the agent works.
    """
    try:
        # First, read the existing component
        from .tools import read_component
        read_result = read_component(component_name)

        if read_result.get('status') != 'success':
            yield {"type": "error", "message": f"Component '{component_name}' not found"}
            return

        existing_code = read_result.get('content', '')

        yield {"type": "progress", "message": f"Reading component '{component_name}'..."}

        # Build initial message
        messages = [
            {
                "role": "user",
                "content": f"""Please edit the React TypeScript component '{component_name}' based on this description:

{edit_description}

Here is the current component code:

```tsx
{existing_code}
```

Requirements:
- Maintain TypeScript with proper type definitions
- Keep using Tailwind CSS for styling
- Keep it as a functional component with export default
- Preserve the core functionality while making the requested changes
- Use modern React patterns

IMPORTANT: You must use the update_component tool to save the modified component. Do not just describe the component - actually call the update_component tool with the full component code."""
            }
        ]

        # Agent loop
        max_iterations = 5
        iteration = 0

        yield {"type": "progress", "message": "Starting AI agent..."}

        while iteration < max_iterations:
            iteration += 1

            yield {"type": "progress", "message": f"Agent iteration {iteration}/{max_iterations}..."}

            # Call Claude API with streaming
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                tools=TOOLS,
                messages=messages,
                stream=False  # We'll handle our own event streaming
            )

            # Check if Claude wants to use a tool
            if response.stop_reason == "tool_use":
                # Add assistant response to messages
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })

                # Process tool calls
                tool_results = []
                for content_block in response.content:
                    if content_block.type == "tool_use":
                        tool_name = content_block.name
                        tool_input = content_block.input

                        yield {"type": "progress", "message": f"Calling tool: {tool_name}..."}

                        # Execute the tool
                        result = process_tool_call(tool_name, tool_input)

                        # Add tool result
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": json.dumps(result)
                        })

                        # If component was updated successfully, return
                        if tool_name == "update_component" and result.get("status") == "success":
                            yield {"type": "success", "message": f"Component '{component_name}' updated successfully!"}
                            return

                # Add tool results to messages
                messages.append({
                    "role": "user",
                    "content": tool_results
                })

            elif response.stop_reason == "end_turn":
                # Claude finished without using tools
                # Check if component was actually updated
                from .tools import read_component
                check_result = read_component(component_name)

                if check_result.get('status') == 'success' and check_result.get('content') != existing_code:
                    # Component was updated
                    yield {"type": "success", "message": f"Component '{component_name}' updated successfully!"}
                    return

                # Component wasn't updated, prompt Claude to use the tool
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                messages.append({
                    "role": "user",
                    "content": "Please use the update_component tool to save the modified component code. Don't just describe it - actually call the tool with the component code."
                })

                yield {"type": "progress", "message": "Prompting agent to use tool..."}
                # Continue the loop to try again
                continue

            else:
                # Other stop reason
                yield {"type": "error", "message": f"Agent stopped unexpectedly: {response.stop_reason}"}
                return

        # Max iterations reached
        yield {"type": "error", "message": "Component edit exceeded maximum iterations"}

    except Exception as e:
        yield {"type": "error", "message": f"Error editing component: {str(e)}"}


def generate_component(prompt: str, component_name: str) -> dict:
    """
    Use Claude to generate a React component based on a natural language prompt.

    Args:
        prompt: Natural language description of the component
        component_name: Suggested name for the component

    Returns:
        dict: Result containing status, component name, and any messages
    """
    try:
        # Build initial message
        messages = [
            {
                "role": "user",
                "content": f"""Create a React TypeScript component named '{component_name}' based on this description:

{prompt}

Requirements:
- Use TypeScript with proper type definitions
- Use Tailwind CSS for all styling
- Make it a functional component with export default
- Make it responsive and accessible
- Include any necessary props with TypeScript interfaces
- Use modern React patterns (hooks if needed)

IMPORTANT: You must use the create_component tool to save the component. Do not just describe the component - actually call the create_component tool with the full component code."""
            }
        ]

        # Agent loop
        max_iterations = 5
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # Call Claude API
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                tools=TOOLS,
                messages=messages
            )

            # Check if Claude wants to use a tool
            if response.stop_reason == "tool_use":
                # Add assistant response to messages
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })

                # Process tool calls
                tool_results = []
                for content_block in response.content:
                    if content_block.type == "tool_use":
                        tool_name = content_block.name
                        tool_input = content_block.input

                        # Execute the tool
                        result = process_tool_call(tool_name, tool_input)

                        # Add tool result
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": json.dumps(result)
                        })

                        # If component was created successfully, return
                        if tool_name == "create_component" and result.get("status") == "success":
                            return result

                # Add tool results to messages
                messages.append({
                    "role": "user",
                    "content": tool_results
                })

            elif response.stop_reason == "end_turn":
                # Claude finished without using tools
                # Check if component was actually created (might have been created in a previous call)
                from .tools import read_component
                check_result = read_component(component_name)

                if check_result.get('status') == 'success':
                    # Component exists, return success
                    return check_result

                # Component doesn't exist, prompt Claude to use the tool
                text_response = ""
                for content_block in response.content:
                    if hasattr(content_block, "text"):
                        text_response += content_block.text

                # Add a follow-up message to encourage tool use
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                messages.append({
                    "role": "user",
                    "content": "Please use the create_component tool to save the component code. Don't just describe it - actually call the tool with the component code."
                })
                # Continue the loop to try again
                continue

            else:
                # Other stop reason (max_tokens, etc.)
                return {
                    "status": "error",
                    "message": f"Component generation stopped unexpectedly: {response.stop_reason}"
                }

        # Max iterations reached
        return {
            "status": "error",
            "message": "Component generation exceeded maximum iterations"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error generating component: {str(e)}"
        }


def edit_component(component_name: str, edit_description: str) -> dict:
    """
    Use Claude to edit an existing React component based on a natural language description.

    Args:
        component_name: Name of the component to edit
        edit_description: Description of what changes to make

    Returns:
        dict: Result containing status and any messages
    """
    try:
        # First, read the existing component
        from .tools import read_component
        read_result = read_component(component_name)

        if read_result.get('status') != 'success':
            return {
                "status": "error",
                "message": f"Component '{component_name}' not found"
            }

        existing_code = read_result.get('content', '')

        # Build initial message
        messages = [
            {
                "role": "user",
                "content": f"""Please edit the React TypeScript component '{component_name}' based on this description:

{edit_description}

Here is the current component code:

```tsx
{existing_code}
```

Requirements:
- Maintain TypeScript with proper type definitions
- Keep using Tailwind CSS for styling
- Keep it as a functional component with export default
- Preserve the core functionality while making the requested changes
- Use modern React patterns

Use the update_component tool to save the modified component."""
            }
        ]

        # Agent loop
        max_iterations = 5
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # Call Claude API
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4096,
                tools=TOOLS,
                messages=messages
            )

            # Check if Claude wants to use a tool
            if response.stop_reason == "tool_use":
                # Add assistant response to messages
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })

                # Process tool calls
                tool_results = []
                for content_block in response.content:
                    if content_block.type == "tool_use":
                        tool_name = content_block.name
                        tool_input = content_block.input

                        # Execute the tool
                        result = process_tool_call(tool_name, tool_input)

                        # Add tool result
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": json.dumps(result)
                        })

                        # If component was updated successfully, return
                        if tool_name == "update_component" and result.get("status") == "success":
                            return result

                # Add tool results to messages
                messages.append({
                    "role": "user",
                    "content": tool_results
                })

            elif response.stop_reason == "end_turn":
                # Claude finished without using tools
                text_response = ""
                for content_block in response.content:
                    if hasattr(content_block, "text"):
                        text_response += content_block.text

                return {
                    "status": "error",
                    "message": f"Component edit failed. Claude's response: {text_response}"
                }

            else:
                # Other stop reason
                return {
                    "status": "error",
                    "message": f"Component edit stopped unexpectedly: {response.stop_reason}"
                }

        # Max iterations reached
        return {
            "status": "error",
            "message": "Component edit exceeded maximum iterations"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error editing component: {str(e)}"
        }


def export_page_with_layout(page_name: str, layout_data: dict) -> dict:
    """
    Create a page file based on the canvas layout.

    Args:
        page_name: Name for the exported page
        layout_data: Dictionary containing component layout information

    Returns:
        dict: Result containing the generated page code and filepath
    """
    try:
        # Convert layout data to JSON string
        layout_json = json.dumps(layout_data)

        # Use the create_page tool
        result = create_page(page_name, layout_json)

        return result

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error exporting page: {str(e)}"
        }
