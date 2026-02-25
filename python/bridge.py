import sys
import pyautogui
import pyperclip
import time
import json
import os
import subprocess
import traceback

def open_app(app_name):
    try:
        os.startfile(app_name)
        print(json.dumps({"success": True, "message": f"Successfully launched {app_name}"}))
    except Exception:
        try:
            subprocess.run(["start", "", app_name], shell=True, check=True)
            print(json.dumps({"success": True, "message": f"Launched {app_name} via shell"}))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))

def type_text(text):
    try:
        pyautogui.write(text, interval=0.01)
        print(json.dumps({"success": True, "message": "Text typed successfully"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def whatsapp_send(message):
    try:
        time.sleep(5)
        for i in range(3):
            pyautogui.press('enter')
            time.sleep(0.5)
        print(json.dumps({"success": True, "message": "Automation sequence complete!"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def capture_screen():
    try:
        import mss
        import mss.tools
        
        # Absolute pathing relative to this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        screenshot_dir = os.path.join(project_root, 'data', 'screenshots')
        
        if not os.path.exists(screenshot_dir):
            os.makedirs(screenshot_dir, exist_ok=True)
            
        timestamp = int(time.time())
        filename = f"screenshot_{timestamp}.png"
        filepath = os.path.join(screenshot_dir, filename)
        
        # Take screenshot - Using MSS (faster and more reliable for background)
        with mss.mss() as sct:
            # The screen part to capture (monitor 1)
            # Log monitor info for debugging
            monitors = sct.monitors
            monitor = monitors[1]
            sct_img = sct.grab(monitor)
            
            # Save the image
            mss.tools.to_png(sct_img.rgb, sct_img.size, output=filepath)
            
        if os.path.exists(filepath):
            print(json.dumps({
                "success": True, 
                "path": filepath, 
                "filename": filename,
                "size": os.path.getsize(filepath),
                "debug_root": project_root
            }))
        else:
            print(json.dumps({"success": False, "error": "MSS failed to save file"}))
            
    except ImportError:
        print(json.dumps({"success": False, "error": "mss library not installed. please run pip install mss"}))
    except Exception as e:
        print(json.dumps({
            "success": False, 
            "error": str(e), 
            "traceback": traceback.format_exc()
        }))

def focus_window(title_part):
    try:
        import pygetwindow as gw
        windows = gw.getWindowsWithTitle(title_part)
        if windows:
            win = windows[0]
            if win.isMinimized:
                win.restore()
            win.activate()
            print(json.dumps({"success": True, "message": f"Focused window: {win.title}"}))
        else:
            print(json.dumps({"success": False, "error": f"No window found with title: {title_part}"}))
    except ImportError:
        print(json.dumps({"success": False, "error": "pygetwindow not installed. Run: pip install pygetwindow"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def list_windows():
    try:
        import pygetwindow as gw
        titles = [w.title for w in gw.getAllTitles() if w.strip()]
        print(json.dumps({"success": True, "titles": titles}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"success": False, "error": "No action specified"}))
            sys.exit(1)
            
        action = sys.argv[1]
        
        if action == "whatsapp_send":
            whatsapp_send("")
        elif action == "open_app":
            if len(sys.argv) > 2:
                open_app(sys.argv[2])
            else:
                print(json.dumps({"success": False, "error": "No app name provided"}))
        elif action == "type_text":
            if len(sys.argv) > 2:
                type_text(sys.argv[2])
            else:
                print(json.dumps({"success": False, "error": "No text provided"}))
        elif action == "capture_screen":
            capture_screen()
        elif action == "focus_window":
            if len(sys.argv) > 2:
                focus_window(sys.argv[2])
            else:
                print(json.dumps({"success": False, "error": "No title provided"}))
        elif action == "list_windows":
            list_windows()
        else:
            print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))
    except Exception as e:
        # Catch EVERYTHING and print as JSON
        print(json.dumps({
            "success": False, 
            "error": str(e), 
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)
