import os
import json
import uuid
from anthropic import Anthropic
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Anthropic client
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def generate_interaction(component_id: str, component_name: str, description: str, event_type: str) -> dict:
    """
    Use Claude to generate a React event handler based on a natural language description.

    Args:
        component_id: ID of the component this interaction belongs to
        component_name: Name of the component
        description: Natural language description of what should happen
        event_type: Type of event (onClick, onChange, onSubmit, etc.)

    Returns:
        dict: Result containing the generated interaction with handler code
    """
    try:
        # Call Claude API
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": f"""Generate a React event handler for the following interaction:

Component: {component_name}
Event Type: {event_type}
Description: {description}

Please generate:
1. A handler function name (e.g., handleButtonClick, handleInputChange)
2. The complete handler function code in TypeScript
3. Any state variables needed (using useState)

Requirements:
- Use TypeScript
- Follow React best practices
- Keep it simple and focused on the described behavior
- Include comments explaining the logic
- If state is needed, identify what state variables are required

Respond with a JSON object in this exact format:
{{
  "handlerName": "string (e.g., handleClick)",
  "code": "string (complete handler function code)",
  "state": [
    {{
      "name": "string (state variable name)",
      "type": "string (TypeScript type)",
      "initialValue": "any (initial value as JSON)"
    }}
  ]
}}

Example for "Show an alert when clicked":
{{
  "handlerName": "handleClick",
  "code": "const handleClick = () => {{\\n  alert('Button clicked!');\\n}}",
  "state": []
}}

Example for "Count button clicks":
{{
  "handlerName": "handleClick",
  "code": "const handleClick = () => {{\\n  setClickCount(clickCount + 1);\\n  alert(`Clicked ${{clickCount + 1}} times!`);\\n}}",
  "state": [
    {{
      "name": "clickCount",
      "type": "number",
      "initialValue": 0
    }}
  ]
}}

Only respond with the JSON object, no additional text."""
                }
            ]
        )

        # Extract text response
        text_response = ""
        for content_block in response.content:
            if hasattr(content_block, "text"):
                text_response += content_block.text

        # Parse JSON response
        # Clean up markdown code blocks if present
        text_response = text_response.strip()
        if text_response.startswith("```json"):
            text_response = text_response[7:]
        if text_response.startswith("```"):
            text_response = text_response[3:]
        if text_response.endswith("```"):
            text_response = text_response[:-3]
        text_response = text_response.strip()

        parsed_response = json.loads(text_response)

        # Create interaction object
        interaction = {
            "id": str(uuid.uuid4()),
            "type": event_type,
            "description": description,
            "handlerName": parsed_response.get("handlerName", "handleEvent"),
            "code": parsed_response.get("code", ""),
            "state": parsed_response.get("state", [])
        }

        return {
            "status": "success",
            "interaction": interaction
        }

    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "message": f"Failed to parse AI response: {str(e)}. Response was: {text_response[:200]}"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error generating interaction: {str(e)}"
        }
