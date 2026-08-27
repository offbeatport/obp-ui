// obp-ui/nav-ui - navigation *looks* that are still being chosen between, kept out of ./nav
// (which holds the one blessed link/tab implementation the app actually routes through).
//
// Its own entry point, not part of the root barrel, for the same identity reason as shell and
// chat - a tab treatment is the most visible thing on a page - plus a shape reason: this is a
// bag of ten alternatives to audition, and ten near-duplicate names in the root barrel is
// noise for every consumer that already picked one.

export {
    CommandBar,
    FloatingDock,
    GlowTabs,
    IconPills,
    MorphDropdown,
    NumberedTicker,
    SegmentedPill,
    StatusTabs,
    TAB_SELECTORS,
    type TabSelectorDef,
    type TabSelectorProps,
    UnderlineSlide,
    VerticalRail,
    withTabIcons,
} from "./tab-selector-gallery";
