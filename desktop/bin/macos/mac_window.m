#import <Cocoa/Cocoa.h>
#include "gdextension_interface.h"
#include <pthread.h>
#include <unistd.h>
#import <objc/runtime.h>

#define FLAG_FILE_PATH "/tmp/mcd_show_over_fullscreen.flag"

static int g_current_mode = -1;
static int g_last_window_count = -1;
static NSApplicationActivationPolicy g_current_policy = (NSApplicationActivationPolicy)-1;
static pthread_t g_monitor_thread;
static volatile bool g_running = true;
static NSStatusItem *g_status_item = nil;

// Helper to determine the active Go backend port
static int get_active_server_port(void) {
    char *env_port = getenv("MCD_SERVER_PORT");
    if (!env_port) env_port = getenv("MCD_PORT");
    if (env_port && atoi(env_port) > 0) {
        return atoi(env_port);
    }
    NSString *home = NSHomeDirectory();
    NSString *portPath = [home stringByAppendingPathComponent:@".mcd-desktop-pet/run/server.port"];
    NSString *content = [NSString stringWithContentsOfFile:portPath encoding:NSUTF8StringEncoding error:nil];
    if (content) {
        int p = [content stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].intValue;
        if (p > 0) return p;
    }
    return 23301;
}

// Send an HTTP POST to local backend
static void send_post_request(NSString *path, NSData *body) {
    int port = get_active_server_port();
    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d%@", port, path]];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    req.HTTPMethod = @"POST";
    req.timeoutInterval = 3.0;
    if (body) {
        [req setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
        req.HTTPBody = body;
    }
    [[[NSURLSession sharedSession] dataTaskWithRequest:req] resume];
}

// Open Web console in user's browser
static void open_web_ui(NSString *path) {
    int port = get_active_server_port();
    NSString *urlStr = [NSString stringWithFormat:@"http://127.0.0.1:%d%@", port, path ?: @""];
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:urlStr]];
}

// Status Bar Menu Action Handler
@interface McdStatusMenuHandler : NSObject <NSMenuDelegate>
- (void)setThemeMenuItem:(NSMenuItem *)item;
- (void)onNewNote:(id)sender;
- (void)onOpenNoteBox:(id)sender;
- (void)onToggleVisibility:(id)sender;
- (void)onToggleTheme:(id)sender;
- (void)onOpenSettings:(id)sender;
- (void)onExitApp:(id)sender;
@end

@implementation McdStatusMenuHandler {
    __weak NSMenuItem *_themeMenuItem;
}

- (void)setThemeMenuItem:(NSMenuItem *)item {
    _themeMenuItem = item;
}

- (void)menuWillOpen:(NSMenu *)menu {
    if (_themeMenuItem) {
        NSString *home = NSHomeDirectory();
        NSString *cfgPath = [home stringByAppendingPathComponent:@".mcd-desktop-pet/config.json"];
        NSData *cfgData = [NSData dataWithContentsOfFile:cfgPath];
        NSString *themeName = @"麦当劳";
        if (cfgData) {
            NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:cfgData options:0 error:nil];
            if ([dict[@"theme"] isEqualToString:@"pure"]) {
                themeName = @"纯净";
            }
        }
        _themeMenuItem.title = [NSString stringWithFormat:@"🎨 切换外观主题 (当前: %@)", themeName];
    }
}

- (void)onNewNote:(id)sender {
    NSData *body = [@"{\"title\":\"新建便签\",\"content\":\"记录一下灵感或待办事项~📝\"}" dataUsingEncoding:NSUTF8StringEncoding];
    send_post_request(@"/api/notes", body);
}

- (void)onOpenNoteBox:(id)sender {
    open_web_ui(@"");
}

- (void)onToggleVisibility:(id)sender {
    send_post_request(@"/api/pet/visibility/toggle", nil);
}

- (void)onToggleTheme:(id)sender {
    NSString *home = NSHomeDirectory();
    NSString *cfgPath = [home stringByAppendingPathComponent:@".mcd-desktop-pet/config.json"];
    NSData *cfgData = [NSData dataWithContentsOfFile:cfgPath];
    NSString *nextTheme = @"pure";
    if (cfgData) {
        NSDictionary *dict = [NSJSONSerialization JSONObjectWithData:cfgData options:0 error:nil];
        if ([dict[@"theme"] isEqualToString:@"pure"]) {
            nextTheme = @"mcdonalds";
        }
    }
    NSData *body = [NSJSONSerialization dataWithJSONObject:@{@"theme": nextTheme} options:0 error:nil];
    send_post_request(@"/api/config/theme", body);
}

- (void)onOpenSettings:(id)sender {
    open_web_ui(@"");
}

- (void)onExitApp:(id)sender {
    send_post_request(@"/api/system/exit", nil);
}
@end

static McdStatusMenuHandler *g_menu_handler = nil;

static void setup_status_bar(void) {
    if (g_status_item) return;

    g_status_item = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
    if (!g_status_item) return;

    // Load status bar icon
    NSImage *icon = nil;
    NSString *resPath = [[NSBundle mainBundle] resourcePath];
    if (resPath) {
        for (NSString *name in @[@"icon.png", @"icon.icns", @"icon.svg"]) {
            NSString *p = [resPath stringByAppendingPathComponent:name];
            if ([[NSFileManager defaultManager] fileExistsAtPath:p]) {
                icon = [[NSImage alloc] initWithContentsOfFile:p];
                if (icon && [icon isValid]) break;
            }
        }
    }

    if (!icon || ![icon isValid]) {
        NSArray *candidates = @[
            @"desktop/icon.png",
            @"desktop/icon.icns",
            @"desktop/icon.svg",
            @"icon.png",
            @"icon.icns",
            @"icon.svg",
            @"../desktop/icon.png",
            @"../desktop/icon.svg"
        ];
        for (NSString *cand in candidates) {
            if ([[NSFileManager defaultManager] fileExistsAtPath:cand]) {
                icon = [[NSImage alloc] initWithContentsOfFile:cand];
                if (icon && [icon isValid]) break;
            }
        }
    }

    if (icon && [icon isValid]) {
        [icon setSize:NSMakeSize(18, 18)];
        g_status_item.button.image = icon;
        g_status_item.button.imagePosition = NSImageOnly;
    } else {
        g_status_item.button.title = @"🍟";
    }
    g_status_item.button.toolTip = @"麦当劳便利贴桌宠";

    // Build Status Menu
    g_menu_handler = [[McdStatusMenuHandler alloc] init];
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@"麦当劳便利贴桌宠"];
    menu.delegate = g_menu_handler;

    NSMenuItem *itemNote = [[NSMenuItem alloc] initWithTitle:@"📝 新建便利贴          Ctrl+N" action:@selector(onNewNote:) keyEquivalent:@""];
    itemNote.target = g_menu_handler;
    [menu addItem:itemNote];

    NSMenuItem *itemBox = [[NSMenuItem alloc] initWithTitle:@"📦 历史便签盒          Ctrl+B" action:@selector(onOpenNoteBox:) keyEquivalent:@""];
    itemBox.target = g_menu_handler;
    [menu addItem:itemBox];

    [menu addItem:[NSMenuItem separatorItem]];

    NSMenuItem *itemTheme = [[NSMenuItem alloc] initWithTitle:@"🎨 切换外观主题 (当前: 麦当劳)" action:@selector(onToggleTheme:) keyEquivalent:@""];
    itemTheme.target = g_menu_handler;
    [g_menu_handler setThemeMenuItem:itemTheme];
    [menu addItem:itemTheme];

    NSMenuItem *itemVis = [[NSMenuItem alloc] initWithTitle:@"👁️ 显示 / 隐藏桌面全部内容" action:@selector(onToggleVisibility:) keyEquivalent:@""];
    itemVis.target = g_menu_handler;
    [menu addItem:itemVis];

    NSMenuItem *itemSettings = [[NSMenuItem alloc] initWithTitle:@"⚙️ 偏好设置" action:@selector(onOpenSettings:) keyEquivalent:@""];
    itemSettings.target = g_menu_handler;
    [menu addItem:itemSettings];

    [menu addItem:[NSMenuItem separatorItem]];

    NSMenuItem *itemExit = [[NSMenuItem alloc] initWithTitle:@"🚪 退出" action:@selector(onExitApp:) keyEquivalent:@""];
    itemExit.target = g_menu_handler;
    [menu addItem:itemExit];

    g_status_item.menu = menu;
}

static NSRect pet_constrainFrameRect(id self, SEL _cmd, NSRect frameRect, NSScreen *screen) {
    (void)self;
    (void)_cmd;
    (void)screen;
    return frameRect;
}

static void setup_constrain_swizzling(NSWindow *window) {
    if (!window) return;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class cls = [window class];
        Method m = class_getInstanceMethod(cls, @selector(constrainFrameRect:toScreen:));
        if (m) {
            BOOL added = class_addMethod(cls, @selector(constrainFrameRect:toScreen:), (IMP)pet_constrainFrameRect, method_getTypeEncoding(m));
            if (!added) {
                method_setImplementation(m, (IMP)pet_constrainFrameRect);
            }
        }
    });
}

static void apply_window_settings(int mode) {
    (void)mode;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!g_running) return;

        // Set activation policy to Accessory:
        // 1. Removes the app from the Dock.
        // 2. Allows windows to follow into foreign Full Screen Spaces!
        NSApplicationActivationPolicy target_policy = NSApplicationActivationPolicyAccessory;

        if (g_current_policy != target_policy) {
            g_current_policy = target_policy;
            [NSApp setActivationPolicy:target_policy];
        }

        setup_status_bar();

        NSWindowLevel target_level = (NSWindowLevel)1000;
        NSWindowCollectionBehavior target_behavior =
            NSWindowCollectionBehaviorCanJoinAllSpaces |
            NSWindowCollectionBehaviorFullScreenAuxiliary |
            NSWindowCollectionBehaviorStationary |
            NSWindowCollectionBehaviorCanJoinAllApplications;
        BOOL target_hides = NO;

        NSArray *windows = [NSApp windows];
        g_last_window_count = (int)[windows count];

        for (NSWindow *window in windows) {
            NSString *cls = NSStringFromClass([window class]);
            if ([cls containsString:@"GodotWindow"] || [cls containsString:@"Window"]) {
                if ([cls containsString:@"NSStatusBarWindow"] || [cls containsString:@"NSPopup"]) {
                    continue;
                }
                setup_constrain_swizzling(window);
                // Only touch window properties if not already configured
                if (window.level != target_level || window.collectionBehavior != target_behavior) {
                    window.level = target_level;
                    window.collectionBehavior = target_behavior;
                    window.hidesOnDeactivate = target_hides;
                    [window orderFrontRegardless];
                }
            }
        }
    });
}

static void* monitor_thread_func(void* arg) {
    (void)arg;
    while (g_running) {
        FILE *f = fopen(FLAG_FILE_PATH, "r");
        if (f) {
            char buf[16] = {0};
            if (fgets(buf, sizeof(buf), f)) {
                int mode = (buf[0] == '1') ? 1 : 0;
                if (mode != g_current_mode) {
                    g_current_mode = mode;
                    apply_window_settings(mode);
                } else if (g_current_mode >= 0) {
                    // Check if window count changed (e.g. main window just appeared)
                    dispatch_async(dispatch_get_main_queue(), ^{
                        if (g_running && (int)[[NSApp windows] count] != g_last_window_count) {
                            apply_window_settings(g_current_mode);
                        }
                    });
                }
            }
            fclose(f);
        } else {
            // Apply default settings if flag file doesn't exist yet
            if (g_current_mode < 0) {
                g_current_mode = 1;
                apply_window_settings(1);
            }
        }
        // Sleep 500ms in 50ms intervals so thread exits promptly on shutdown
        for (int i = 0; i < 10 && g_running; i++) {
            usleep(50000);
        }
    }
    return NULL;
}

static void my_initialize(void *p_userdata, GDExtensionInitializationLevel p_level) {
    (void)p_userdata;
    if (p_level == GDEXTENSION_INITIALIZATION_SCENE) {
        g_running = true;
        dispatch_async(dispatch_get_main_queue(), ^{
            void (^on_win_event)(NSNotification *) = ^(NSNotification *note) {
                if (g_running && g_current_mode >= 0) {
                    apply_window_settings(g_current_mode);
                }
            };
            [[NSNotificationCenter defaultCenter] addObserverForName:NSWindowDidBecomeKeyNotification
                                                              object:nil
                                                               queue:[NSOperationQueue mainQueue]
                                                          usingBlock:on_win_event];
            [[NSNotificationCenter defaultCenter] addObserverForName:NSWindowDidBecomeMainNotification
                                                              object:nil
                                                               queue:[NSOperationQueue mainQueue]
                                                          usingBlock:on_win_event];
        });
        pthread_create(&g_monitor_thread, NULL, monitor_thread_func, NULL);
    }
}

static void my_deinitialize(void *p_userdata, GDExtensionInitializationLevel p_level) {
    (void)p_userdata;
    if (p_level == GDEXTENSION_INITIALIZATION_SCENE) {
        g_running = false;
        if (g_status_item) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (g_status_item) {
                    [[NSStatusBar systemStatusBar] removeStatusItem:g_status_item];
                    g_status_item = nil;
                }
            });
        }
        pthread_join(g_monitor_thread, NULL);
    }
}

__attribute__((visibility("default")))
GDExtensionBool mac_window_init(
    GDExtensionInterfaceGetProcAddress p_get_proc_address,
    GDExtensionClassLibraryPtr p_library,
    GDExtensionInitialization *r_initialization
) {
    (void)p_get_proc_address;
    (void)p_library;
    r_initialization->minimum_initialization_level = GDEXTENSION_INITIALIZATION_SCENE;
    r_initialization->initialize = &my_initialize;
    r_initialization->deinitialize = &my_deinitialize;
    r_initialization->userdata = NULL;
    return 1;
}
