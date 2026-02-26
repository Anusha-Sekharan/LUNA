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

def whatsapp_send(contact_name, message):
    try:
        # 1. Wait for WhatsApp to completely load/focus (5 seconds delay in main.js + 2 here)
        time.sleep(2)
        
        # 2. Focus the Search Bar (Ctrl+F is the shortcut for WhatsApp Desktop on Windows)
        pyautogui.hotkey('ctrl', 'f')
        time.sleep(1)
        
        # 3. Type the contact name
        pyautogui.write(contact_name, interval=0.05)
        time.sleep(2) # Wait for search results
        
        # 4. Press Enter to select the top contact
        pyautogui.press('enter')
        time.sleep(1)
        
        # 5. Type the message
        pyautogui.write(message, interval=0.02)
        time.sleep(0.5)
        
        # 6. Press Enter to Send
        pyautogui.press('enter')
        
        print(json.dumps({"success": True, "message": f"Message sent to {contact_name} successfully!"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def gmail_send():
    """
    Automates sending the pre-filled Gmail draft.
    Assumes the browser is already focused and the Gmail compose window 
    is loaded (handled by main.js shell.openExternal and a delay).
    """
    try:
        # Give it a tiny bit of extra time to ensure focus
        time.sleep(1)
        
        # In Gmail, Ctrl+Enter is the shortcut to send a message
        pyautogui.hotkey('ctrl', 'enter')
        
        print(json.dumps({"success": True, "message": "Email sent successfully!"}))
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
            if len(sys.argv) > 3:
                whatsapp_send(sys.argv[2], sys.argv[3])
            else:
                print(json.dumps({"success": False, "error": "Contact name or message missing"}))
        elif action == "gmail_send":
            gmail_send()
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
