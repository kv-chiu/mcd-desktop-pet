#import <Cocoa/Cocoa.h>
#include "gdextension_interface.h"
#include <pthread.h>
#include <unistd.h>

#define FLAG_FILE_PATH "/tmp/mcd_show_over_fullscreen.flag"

static int g_current_mode = -1;
static pthread_t g_monitor_thread;
static volatile bool g_running = true;

static void apply_window_settings(int mode) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSArray *windows = [NSApp windows];

        if (mode == 1) {
            [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];

            for (NSWindow *window in windows) {
                if ([window.className containsString:@"GodotWindow"]) {
                    window.level = (NSWindowLevel)1000;
                    window.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces |
                                                NSWindowCollectionBehaviorFullScreenAuxiliary |
                                                NSWindowCollectionBehaviorStationary |
                                                NSWindowCollectionBehaviorCanJoinAllApplications;
                    window.hidesOnDeactivate = NO;
                    [window orderFrontRegardless];
                }
            }
        } else if (mode == 0) {
            [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
            for (NSWindow *window in windows) {
                if ([window.className containsString:@"GodotWindow"]) {
                    window.level = NSFloatingWindowLevel;
                    window.collectionBehavior = NSWindowCollectionBehaviorDefault;
                    window.hidesOnDeactivate = YES;
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
                }
            }
            fclose(f);
        }
        usleep(300000);
    }
    return NULL;
}

static void my_initialize(void *p_userdata, GDExtensionInitializationLevel p_level) {
    (void)p_userdata;
    if (p_level == GDEXTENSION_INITIALIZATION_SCENE) {
        g_running = true;
        pthread_create(&g_monitor_thread, NULL, monitor_thread_func, NULL);
    }
}

static void my_deinitialize(void *p_userdata, GDExtensionInitializationLevel p_level) {
    (void)p_userdata;
    if (p_level == GDEXTENSION_INITIALIZATION_SCENE) {
        g_running = false;
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
