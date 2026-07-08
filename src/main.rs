mod keyboard;

use keyboard::{LayoutId, LAYOUTS};
use leptos::*;

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
    ch.to_string()
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

    create_effect(move |_| {
        layout_id.get();
        set_cursor.set(0);
        set_mistakes.set(0);
        set_last_wrong.set(None);
    });

    create_effect(move |_| {
        cursor.get();
        scroll_current_into_view();
    });

    let on_keydown = move |event: web_sys::KeyboardEvent| {
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
