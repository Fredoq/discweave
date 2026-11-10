import { useRef, useState, type ReactNode } from 'react'
type InspectorTab = 'relationships' | 'collection'
const tabs: InspectorTab[] = ['relationships', 'collection']
export function ArtistInspectorTabs({
  relationships,
  collection,
}: Readonly<{ relationships: ReactNode; collection: ReactNode }>) {
  const [selected, setSelected] = useState<InspectorTab>('relationships')
  const tabList = useRef<HTMLDivElement>(null)
  return (
    <div className="artist-inspector-content">
      <div
        role="tablist"
        aria-label="Artist details"
        className="artist-inspector-tabs"
        ref={tabList}
        onKeyDown={(event) => {
          const index = tabs.indexOf(selected)
          let next: InspectorTab
          if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length]
          else if (event.key === 'ArrowLeft')
            next = tabs[(index + tabs.length - 1) % tabs.length]
          else if (event.key === 'Home') next = tabs[0]
          else if (event.key === 'End') next = tabs[tabs.length - 1]
          else return
          event.preventDefault()
          setSelected(next)
          tabList.current
            ?.querySelector<HTMLButtonElement>(`#artist-${next}-tab`)
            ?.focus()
        }}
      >
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`artist-${tab}-tab`}
            key={tab}
            aria-selected={selected === tab}
            aria-controls={`artist-${tab}-panel`}
            tabIndex={selected === tab ? 0 : -1}
            onClick={() => setSelected(tab)}
          >
            {tab === 'relationships' ? 'Relationships' : 'Collection'}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          role="tabpanel"
          id={`artist-${tab}-panel`}
          key={tab}
          aria-labelledby={`artist-${tab}-tab`}
          hidden={selected !== tab}
          tabIndex={0}
          className="artist-inspector-tabpanel"
        >
          {tab === 'relationships' ? relationships : collection}
        </div>
      ))}
    </div>
  )
}
