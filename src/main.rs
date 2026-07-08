mod keyboard;

use keyboard::{LayoutId, LAYOUTS};
use leptos::*;
use wasm_bindgen::{closure::Closure, JsCast};

const WORDS: &[&str] = &[
    "truth", "stone", "train", "notes", "calm", "hands", "clear", "steady", "practice", "layout",
    "baremak", "colemak", "dvorak", "qwerty", "focus", "signal", "rhythm", "line", "cursor",
    "letter", "quiet", "exact", "typing", "speed", "memory", "repeat", "system", "syntax",
    "buffer", "window", "branch", "commit", "vector", "string", "result", "module", "match",
    "async", "struct", "public", "private", "render", "scroll", "target", "symbol", "layer",
    "right", "index",
];

fn stream_text_until(min_len: usize) -> String {
    let mut text = String::new();
    let mut index = 0usize;

    while text.len() <= min_len {
        if !text.is_empty() {
            text.push(' ');
        }
        text.push_str(WORDS[index % WORDS.len()]);
        index += 1;
    }

    text
}

fn stream_char(index: usize) -> Option<char> {
    stream_text_until(index).chars().nth(index)
}

fn stream_window(cursor: usize) -> Vec<(usize, char)> {
    let start = cursor.saturating_sub(360);
    let end = cursor + 900;
    stream_text_until(end)
        .chars()
        .enumerate()
        .skip(start)
        .take(end - start + 1)
        .collect()
}

fn printable_key(key: &str) -> Option<char> {
    if key == " " || key == "Spacebar" {
        Some(' ')
    } else if key.chars().count() == 1 {
        key.chars().next()
    } else {
        None
    }
}

fn char_text(ch: char) -> String {
    if ch == ' ' {
        " ".to_string()
    } else {
        ch.to_string()
    }
}

fn char_class(index: usize, cursor: usize, ch: char, wrong: bool) -> String {
    let mut class = String::from("char");
    if ch == ' ' {
        class.push_str(" space");
    }
    if index < cursor {
        class.push_str(" typed");
    } else if index == cursor {
        class.push_str(" current");
        if wrong {
            class.push_str(" wrong");
        }
    } else {
        class.push_str(" future");
    }
    class
}

fn browser_now() -> f64 {
    web_sys::window()
        .and_then(|window| window.performance())
        .map(|performance| performance.now())
        .unwrap_or(0.0)
}

fn scroll_current_into_view() {
    let Some(window) = web_sys::window() else {
        return;
    };
    let Some(document) = window.document() else {
        return;
    };
    let Some(element) = document.get_element_by_id("current-char") else {
        return;
    };

    let options = web_sys::ScrollIntoViewOptions::new();
    options.set_behavior(web_sys::ScrollBehavior::Smooth);
    options.set_block(web_sys::ScrollLogicalPosition::Center);
    options.set_inline(web_sys::ScrollLogicalPosition::Nearest);
    element.scroll_into_view_with_scroll_into_view_options(&options);
}

#[component]
fn App() -> impl IntoView {
    let (layout_id, set_layout_id) = create_signal(LayoutId::Baremak);
    let (cursor, set_cursor) = create_signal(0usize);
    let (_mistakes, set_mistakes) = create_signal(0usize);
    let (last_wrong, set_last_wrong) = create_signal(None::<char>);
    let (started_at, set_started_at) = create_signal(None::<f64>);
    let (now, set_now) = create_signal(browser_now());

    create_effect(move |_| {
        layout_id.get();
        set_cursor.set(0);
        set_mistakes.set(0);
        set_last_wrong.set(None);
        set_started_at.set(None);
    });

    create_effect(move |_| {
        cursor.get();
        scroll_current_into_view();
    });

    let interval = web_sys::window().and_then(|window| {
        let callback = Closure::wrap(Box::new(move || set_now.set(browser_now())) as Box<dyn FnMut()>);
        let handle = window
            .set_interval_with_callback_and_timeout_and_arguments_0(
                callback.as_ref().unchecked_ref(),
                500,
            )
            .ok()?;
        Some((window, handle, callback))
    });
    on_cleanup(move || {
        if let Some((window, handle, _callback)) = interval {
            window.clear_interval_with_handle(handle);
        }
    });

    let wpm = create_memo(move |_| {
        let Some(started_at) = started_at.get() else {
            return 0;
        };
        let elapsed_minutes = (now.get() - started_at) / 60_000.0;
        if elapsed_minutes <= 0.0 {
            0
        } else {
            ((cursor.get() as f64 / 5.0) / elapsed_minutes).round() as usize
        }
    });

    let on_keydown = move |event: web_sys::KeyboardEvent| {
        if event.ctrl_key() || event.meta_key() || event.alt_key() {
            return;
        }

        let index = cursor.get();

        if event.key() == "Backspace" {
            event.prevent_default();
            set_cursor.set(index.saturating_sub(1));
            set_last_wrong.set(None);
            return;
        }

        let Some(typed) = printable_key(&event.key()) else {
            return;
        };
        let Some(expected) = stream_char(index) else {
            return;
        };

        event.prevent_default();

        if typed == expected {
            if started_at.get_untracked().is_none() {
                let time = browser_now();
                set_started_at.set(Some(time));
                set_now.set(time);
            }
            set_cursor.set(index + 1);
            set_last_wrong.set(None);
        } else {
            set_mistakes.update(|count| *count += 1);
            set_last_wrong.set(Some(typed));
        }
    };

    view! {
        <main class="shell" tabindex="0" on:keydown=on_keydown>
            <nav class="topline">
                <div class="layouts">
                    {LAYOUTS.iter().map(|layout| {
                        let id = layout.id;
                        view! {
                            <button class:selected=move || layout_id.get() == id on:click=move |_| set_layout_id.set(id)>
                                {layout.name}
                            </button>
                        }
                    }).collect_view()}
                </div>
                <div class="wpm">{move || wpm.get()}</div>
            </nav>

            <section class=move || if last_wrong.get().is_some() { "type-window blocked" } else { "type-window" }>
                <div class="word-stream">
                    {move || {
                        let cursor = cursor.get();
                        let wrong = last_wrong.get().is_some();
                        stream_window(cursor).into_iter().map(|(index, ch)| {
                            let class = char_class(index, cursor, ch, wrong);
                            if index == cursor {
                                view! { <span id="current-char" class=class>{char_text(ch)}</span> }.into_view()
                            } else {
                                view! { <span class=class>{char_text(ch)}</span> }.into_view()
                            }
                        }).collect_view()
                    }}
                </div>
            </section>

        </main>
    }
}

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App /> });
}
