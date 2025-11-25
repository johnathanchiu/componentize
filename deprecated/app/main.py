from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from agent.component_agent import generate_component, edit_component, export_page_with_layout, edit_component_streaming
from agent.interaction_agent import generate_interaction
from agent.tools import list_components, read_component
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Component Builder API is running"})


@app.route('/api/generate-component', methods=['POST'])
def api_generate_component():
    """
    Generate a new React component based on a prompt.

    Expected JSON body:
    {
        "prompt": "Description of the component",
        "componentName": "ComponentName"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        prompt = data.get('prompt')
        component_name = data.get('componentName')

        if not prompt or not component_name:
            return jsonify({
                "status": "error",
                "message": "Both 'prompt' and 'componentName' are required"
            }), 400

        # Generate component using agent
        result = generate_component(prompt, component_name)

        if result.get('status') == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/preview/<component_name>')
def preview_component(component_name):
    """
    Serve a standalone HTML page that renders the component.
    """
    try:
        result = read_component(component_name)

        if result.get('status') != 'success':
            return f"<html><body><p>Component '{component_name}' not found</p></body></html>", 404

        component_code = result.get('content', '')

        # Clean the component code for browser use (remove imports/exports)
        import re
        # Remove import statements
        component_code = re.sub(r'^import\s+.*?;?\s*$', '', component_code, flags=re.MULTILINE)
        # Remove export default
        component_code = re.sub(r'^export\s+default\s+', '', component_code, flags=re.MULTILINE)

        # Create standalone HTML that renders the component
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{component_name} Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {{
            margin: 0;
            padding: 0;
            overflow: hidden;
        }}
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        // Error handler - send errors to parent window
        window.addEventListener('error', function(event) {{
            if (window.parent) {{
                window.parent.postMessage({{
                    type: 'COMPONENT_ERROR',
                    componentName: '{component_name}',
                    error: {{
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        stack: event.error ? event.error.stack : ''
                    }}
                }}, '*');
            }}
        }});

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {{
            if (window.parent) {{
                window.parent.postMessage({{
                    type: 'COMPONENT_ERROR',
                    componentName: '{component_name}',
                    error: {{
                        message: event.reason ? event.reason.message : 'Unhandled promise rejection',
                        stack: event.reason ? event.reason.stack : ''
                    }}
                }}, '*');
            }}
        }});
    </script>
    <script type="text/babel">
        try {{
            const {{ useState, useEffect, useRef }} = React;

            {component_code}

            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement({component_name}));

            // Notify parent that component loaded successfully
            if (window.parent) {{
                window.parent.postMessage({{
                    type: 'COMPONENT_LOADED',
                    componentName: '{component_name}'
                }}, '*');
            }}
        }} catch (error) {{
            console.error('Component render error:', error);
            if (window.parent) {{
                window.parent.postMessage({{
                    type: 'COMPONENT_ERROR',
                    componentName: '{component_name}',
                    error: {{
                        message: error.message,
                        stack: error.stack
                    }}
                }}, '*');
            }}
        }}
    </script>
</body>
</html>
"""
        return html, 200, {'Content-Type': 'text/html'}

    except Exception as e:
        return f"<html><body><p>Error: {str(e)}</p></body></html>", 500

@app.route('/api/get-component-code/<component_name>', methods=['GET'])
def api_get_component_code(component_name):
    """
    Get the code for a specific component.
    """
    try:
        result = read_component(component_name)

        if result.get('status') == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 404

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/api/list-components', methods=['GET'])
def api_list_components():
    """
    List all generated components.

    Returns JSON with list of component names and filepaths.
    """
    try:
        result = list_components()
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/api/edit-component', methods=['POST'])
def api_edit_component():
    """
    Edit an existing component using AI.

    Expected JSON body:
    {
        "componentName": "ComponentName",
        "editDescription": "Center the text and make the button blue"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        component_name = data.get('componentName')
        edit_description = data.get('editDescription')

        if not component_name or not edit_description:
            return jsonify({
                "status": "error",
                "message": "'componentName' and 'editDescription' are required"
            }), 400

        # Edit component using agent
        result = edit_component(component_name, edit_description)

        if result.get('status') == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/api/edit-component-stream', methods=['POST'])
def api_edit_component_stream():
    """
    Edit an existing component using AI with streaming progress updates.

    Expected JSON body:
    {
        "componentName": "ComponentName",
        "editDescription": "Center the text and make the button blue"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        component_name = data.get('componentName')
        edit_description = data.get('editDescription')

        if not component_name or not edit_description:
            return jsonify({
                "status": "error",
                "message": "'componentName' and 'editDescription' are required"
            }), 400

        def generate():
            """Generator function for streaming updates"""
            try:
                for event in edit_component_streaming(component_name, edit_description):
                    yield f"data: {json.dumps(event)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/api/generate-interaction', methods=['POST'])
def api_generate_interaction():
    """
    Generate an interaction/event handler for a component.

    Expected JSON body:
    {
        "componentId": "unique-id",
        "componentName": "Button",
        "description": "Show an alert when clicked",
        "eventType": "onClick"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        component_id = data.get('componentId')
        component_name = data.get('componentName')
        description = data.get('description')
        event_type = data.get('eventType', 'onClick')

        if not component_id or not component_name or not description:
            return jsonify({
                "status": "error",
                "message": "'componentId', 'componentName', and 'description' are required"
            }), 400

        # Generate interaction using agent
        result = generate_interaction(component_id, component_name, description, event_type)

        if result.get('status') == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/api/export-page', methods=['POST'])
def api_export_page():
    """
    Export the canvas layout as a React page.

    Expected JSON body:
    {
        "pageName": "MyPage",
        "layout": {
            "components": [
                {
                    "componentName": "Button",
                    "position": {"x": 100, "y": 200}
                }
            ]
        }
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No JSON data provided"}), 400

        page_name = data.get('pageName')
        layout = data.get('layout')

        if not page_name or not layout:
            return jsonify({
                "status": "error",
                "message": "Both 'pageName' and 'layout' are required"
            }), 400

        # Export page
        result = export_page_with_layout(page_name, layout)

        if result.get('status') == 'success':
            return jsonify(result), 200
        else:
            return jsonify(result), 500

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


if __name__ == '__main__':
    print("🚀 Component Builder API starting...")
    print("📍 Server running on http://localhost:5001")
    print("💡 Make sure to set ANTHROPIC_API_KEY in .env file")
    app.run(debug=True, host='0.0.0.0', port=5001)
