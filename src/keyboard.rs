use leptos::*;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LayoutId {
    Qwerty,
    Dvorak,
    ColemakDh,
    Baremak,
}

struct KeyDef {
    normal: &'static str,
    alt: Option<&'static str>,
}

pub struct LayoutDef {
    pub id: LayoutId,
    pub name: &'static str,
    rows: &'static [&'static [KeyDef]],
}

const fn key(normal: &'static str, alt: Option<&'static str>) -> KeyDef {
    KeyDef { normal, alt }
}

const QWERTY_ROWS: &[&[KeyDef]] = &[
    &[
        key("q", None),
        key("w", None),
        key("e", None),
        key("r", None),
        key("t", None),
        key("y", None),
        key("u", None),
        key("i", None),
        key("o", None),
        key("p", None),
    ],
    &[
        key("a", None),
        key("s", None),
        key("d", None),
        key("f", None),
        key("g", None),
        key("h", None),
        key("j", None),
        key("k", None),
        key("l", None),
        key(";", None),
        key("'", None),
    ],
    &[
        key("z", None),
        key("x", None),
        key("c", None),
        key("v", None),
        key("b", None),
        key("n", None),
        key("m", None),
        key(",", None),
        key(".", None),
        key("/", None),
    ],
];

const DVORAK_ROWS: &[&[KeyDef]] = &[
    &[
        key("'", None),
        key(",", None),
        key(".", None),
        key("p", None),
        key("y", None),
        key("f", None),
        key("g", None),
        key("c", None),
        key("r", None),
        key("l", None),
        key("/", None),
        key("=", None),
    ],
    &[
        key("a", None),
        key("o", None),
        key("e", None),
        key("u", None),
        key("i", None),
        key("d", None),
        key("h", None),
        key("t", None),
        key("n", None),
        key("s", None),
        key("-", None),
    ],
    &[
        key(";", None),
        key("q", None),
        key("j", None),
        key("k", None),
        key("x", None),
        key("b", None),
        key("m", None),
        key("w", None),
        key("v", None),
        key("z", None),
    ],
];

const COLEMAK_DH_ROWS: &[&[KeyDef]] = &[
    &[
        key("q", None),
        key("w", None),
        key("f", None),
        key("p", None),
        key("b", None),
        key("j", None),
        key("l", None),
        key("u", None),
        key("y", None),
        key(";", None),
    ],
    &[
        key("a", None),
        key("r", None),
        key("s", None),
        key("t", None),
        key("g", None),
        key("m", None),
        key("n", None),
        key("e", None),
        key("i", None),
        key("o", None),
        key("'", None),
    ],
    &[
        key("z", None),
        key("x", None),
        key("c", None),
        key("d", None),
        key("v", None),
        key("k", None),
        key("h", None),
        key(",", None),
        key(".", None),
        key("/", None),
    ],
];

const BAREMAK_ROWS: &[&[KeyDef]] = &[
    &[
        key("q", Some("!")),
        key("w", Some("@")),
        key("f", Some("#")),
        key("p", Some("<")),
        key("b", Some("/")),
        key("j", Some("\\")),
        key("l", Some(">")),
        key("u", Some("&")),
        key("y", Some("$")),
        key(";", Some("|")),
    ],
    &[
        key("a", Some("[")),
        key("r", Some("{")),
        key("s", Some("=")),
        key("t", Some("(")),
        key("g", Some("+")),
        key("m", Some("-")),
        key("n", Some(")")),
        key("e", Some("~")),
        key("i", Some("}")),
        key("o", Some("]")),
        key("'", Some("`")),
    ],
    &[
        key("z", Some("%")),
        key("x", Some("^")),
        key("c", Some("*")),
        key("d", Some("_")),
        key("v", Some("?")),
        key("k", Some(":")),
        key("h", Some(";")),
        key(",", Some("'")),
        key(".", Some("\"")),
        key("/", None),
    ],
];

pub const LAYOUTS: &[LayoutDef] = &[
    LayoutDef {
        id: LayoutId::Qwerty,
        name: "QWERTY",
        rows: QWERTY_ROWS,
    },
    LayoutDef {
        id: LayoutId::Dvorak,
        name: "Dvorak",
        rows: DVORAK_ROWS,
    },
    LayoutDef {
        id: LayoutId::ColemakDh,
        name: "Colemak-DH",
        rows: COLEMAK_DH_ROWS,
    },
    LayoutDef {
        id: LayoutId::Baremak,
        name: "Baremak",
        rows: BAREMAK_ROWS,
    },
];

pub fn layout_by_id(id: LayoutId) -> &'static LayoutDef {
    LAYOUTS.iter().find(|layout| layout.id == id).unwrap()
}

fn key_label(key: &KeyDef, alt: bool) -> &'static str {
    if alt {
        key.alt.unwrap_or(key.normal)
    } else {
        key.normal
    }
}

fn expected_key(layout: &LayoutDef, expected: char) -> Option<(&'static str, bool)> {
    layout
        .rows
        .iter()
        .flat_map(|row| row.iter())
        .find_map(|key| {
            if key.normal.starts_with(expected) {
                Some((key.normal, false))
            } else if key.alt.is_some_and(|alt| alt.starts_with(expected)) {
                Some((key.normal, true))
            } else {
                None
            }
        })
}

#[component]
pub fn KeyboardPane(
    layout_id: ReadSignal<LayoutId>,
    expected: Memo<Option<char>>,
    alt_preview: ReadSignal<bool>,
) -> impl IntoView {
    view! {
        <section class="keyboard-panel">
            <div class=move || if alt_preview.get() { "alt-layer active" } else { "alt-layer" }>
                "alt"
            </div>
            <div class="keyboard">
                {move || {
                    let layout = layout_by_id(layout_id.get());
                    let expected_info = expected.get().and_then(|ch| expected_key(layout, ch));
                    layout.rows.iter().enumerate().map(|(row_index, row)| {
                        let row_class = format!("key-row row-{}", row_index);
                        view! {
                            <div class=row_class>
                                {row.iter().map(|key| {
                                    let use_alt = alt_preview.get() && key.alt.is_some();
                                    let label = key_label(key, use_alt);
                                    let normal = key.normal;
                                    let is_expected = expected_info.map(|(base, _)| base == normal).unwrap_or(false);
                                    let needs_alt = expected_info.map(|(base, alt)| base == normal && alt).unwrap_or(false);
                                    view! {
                                        <div class=move || {
                                            let mut class = String::from("key");
                                            if is_expected {
                                                class.push_str(" expected");
                                            }
                                            if needs_alt {
                                                class.push_str(" needs-alt");
                                            }
                                            class
                                        }>
                                            <span>{label}</span>
                                            {key.alt.map(|alt| view! { <small>{alt}</small> })}
                                        </div>
                                    }
                                }).collect_view()}
                            </div>
                        }
                    }).collect_view()
                }}
            </div>
        </section>
    }
}
