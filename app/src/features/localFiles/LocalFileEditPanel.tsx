import { Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  loadNamingProfiles,
  updateOwnedItemDigitalFile,
  type NamingProfile,
} from '../catalog/catalogApi'
import type { LocalEditableFile, LocalEditTags } from './localFileEditModel'
import {
  applyHelpText,
  applyNamingProfile,
  commonDirectory,
  directoryName,
  errorMessage,
  fileName,
  hasTagValues,
  initialInspectionState,
  joinPath,
  mergePreviewRows,
  normalizePath,
  normalizeTagDraft,
  relativePath,
  tagChangesByDraftId,
  toDraft,
} from './localFileEditHelpers'
import {
  ProfileTemplateSummary,
  ReleaseBatchEditor,
  SingleFileEditor,
} from './LocalFileNameEditor'
import { TagEditMode } from './LocalFileTagEditor'
import type {
  InspectState,
  LocalEditableFileDraft,
  LocalEditMode,
  LocalEditPreviewResult,
} from './localFileEditTypes'
import './local-files.css'

type LocalFileEditPanelProps = {
  files: LocalEditableFile[]
  onApplied?: () => void
  onClose: () => void
}

type LocalEditApplyFileRequest = {
  ownedItemId: string
  currentPath: string
  targetPath: string
  tags?: LocalEditTags
}

export function LocalFileEditPanel({
  files,
  onApplied,
  onClose,
}: LocalFileEditPanelProps) {
  const [activeMode, setActiveMode] = useState<LocalEditMode>('fileNames')
  const [drafts, setDrafts] = useState<LocalEditableFileDraft[]>(() =>
    files.map(toDraft),
  )
  const [inspections, setInspections] = useState<Record<string, InspectState>>(
    () => initialInspectionState(files),
  )
  const [validation, setValidation] = useState<LocalEditPreviewResult | null>(
    null,
  )
  const [selectedTagOwnedItemId, setSelectedTagOwnedItemId] = useState(
    files[0]?.ownedItemId ?? '',
  )
  const [profiles, setProfiles] = useState<NamingProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const bridge = window.discweaveDesktop?.localEdits

  useEffect(() => {
    if (!bridge) {
      return
    }

    let isCancelled = false
    for (const file of files) {
      bridge
        .inspect({ ownedItemId: file.ownedItemId, path: file.currentPath })
        .then((result) => {
          if (!isCancelled) {
            setInspections((current) => ({
              ...current,
              [file.ownedItemId]: { status: 'loaded', result },
            }))
          }
        })
        .catch((inspectError: unknown) => {
          if (!isCancelled) {
            setInspections((current) => ({
              ...current,
              [file.ownedItemId]: {
                status: 'failed',
                message: errorMessage(inspectError, 'File inspection failed.'),
              },
            }))
          }
        })
    }

    return () => {
      isCancelled = true
    }
  }, [bridge, files])

  useEffect(() => {
    let isCancelled = false
    void loadNamingProfiles()
      .then((response) => {
        if (isCancelled) {
          return
        }

        const defaultProfile =
          response.items.find((profile) => profile.isDefault) ??
          response.items[0]
        setProfiles(response.items)
        setSelectedProfileId(defaultProfile?.id ?? '')
        if (defaultProfile) {
          setDrafts((currentDrafts) =>
            applyNamingProfile(
              currentDrafts,
              defaultProfile,
              initialInspectionState(currentDrafts),
            ),
          )
        }
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) {
          setError(errorMessage(loadError, 'Naming profiles failed to load.'))
        }
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedProfileId,
  )
  const currentReleaseFolder = commonDirectory(
    drafts.map((draft) => directoryName(draft.currentPath)),
  )
  const targetReleaseFolder = commonDirectory(
    drafts.map((draft) => directoryName(draft.targetPath)),
  )
  const tagChangesByOwnedItemId = useMemo(
    () => tagChangesByDraftId(drafts, inspections),
    [drafts, inspections],
  )
  const proposedRows = mergePreviewRows(
    drafts,
    validation,
    tagChangesByOwnedItemId,
  )
  const renameCount = proposedRows.filter((row) => row.rename).length
  const unchangedCount = proposedRows.length - renameCount
  const tagUpdateCount = drafts.filter((draft) =>
    hasTagValues(tagChangesByOwnedItemId.get(draft.ownedItemId) ?? {}),
  ).length
  const tagUnchangedCount = drafts.length - tagUpdateCount
  const validationIssues = proposedRows.flatMap((row) =>
    row.issues.map((issue) => ({
      ...issue,
      ownedItemId: row.ownedItemId,
      title: row.title,
    })),
  )
  const actionableRequest = useMemo<{ files: LocalEditApplyFileRequest[] }>(
    () => ({
      files: drafts.flatMap((draft) =>
        activeMode === 'fileNames'
          ? renameRequest(draft)
          : tagRequest(draft, tagChangesByOwnedItemId),
      ),
    }),
    [activeMode, drafts, tagChangesByOwnedItemId],
  )

  const localEdits = bridge

  if (!localEdits) {
    return null
  }
  const localEditBridge = localEdits

  function applyProfile(profileId: string) {
    setSelectedProfileId(profileId)
    const profile = profiles.find((candidate) => candidate.id === profileId)
    if (!profile) {
      return
    }

    setDrafts((currentDrafts) =>
      applyNamingProfile(currentDrafts, profile, inspections),
    )
    clearValidationState()
  }

  function handleModeChange(mode: LocalEditMode) {
    setActiveMode(mode)
    clearValidationState()
  }

  async function handleApply() {
    setIsPending(true)
    setError('')
    setStatus('')
    setValidation(null)

    try {
      if (actionableRequest.files.length === 0) {
        return
      }

      const result = await localEditBridge.apply(actionableRequest)
      if (!result.applied) {
        setValidation({ ok: false, changes: result.changes ?? [] })
        setStatus(
          result.operationLogPath
            ? `Operation log: ${result.operationLogPath}`
            : '',
        )
        setError('Local edit was not applied. Resolve the validation issues.')
        return
      }

      for (const file of result.files) {
        await updateOwnedItemDigitalFile(file.ownedItemId, {
          path: file.path,
          format: file.format,
          sizeBytes: file.sizeBytes,
          lastModifiedAt: file.lastModifiedAt,
          contentHash: file.contentHash,
        })
      }
      const appliedFilesByOwnedItemId = new Map(
        result.files.map((file) => [file.ownedItemId, file]),
      )
      const appliedRequestsByOwnedItemId = new Map(
        actionableRequest.files.map((file) => [file.ownedItemId, file]),
      )
      const draftsByOwnedItemId = new Map(
        drafts.map((draft) => [draft.ownedItemId, draft]),
      )
      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          const appliedFile = appliedFilesByOwnedItemId.get(draft.ownedItemId)
          if (!appliedFile) {
            return draft
          }

          return {
            ...draft,
            currentPath: appliedFile.path,
            targetPath: appliedFile.path,
          }
        }),
      )
      setInspections((currentInspections) => {
        const nextInspections = { ...currentInspections }
        for (const appliedFile of result.files) {
          const currentInspection = currentInspections[appliedFile.ownedItemId]
          if (currentInspection?.status !== 'loaded') {
            continue
          }

          const appliedRequest = appliedRequestsByOwnedItemId.get(
            appliedFile.ownedItemId,
          )
          const appliedDraft = draftsByOwnedItemId.get(appliedFile.ownedItemId)
          nextInspections[appliedFile.ownedItemId] = {
            status: 'loaded',
            result: {
              ...currentInspection.result,
              path: appliedFile.path,
              format: appliedFile.format,
              sizeBytes: appliedFile.sizeBytes,
              lastModifiedAt: appliedFile.lastModifiedAt,
              tags: appliedRequest?.tags
                ? normalizeTagDraft(appliedDraft?.targetTags ?? {})
                : currentInspection.result.tags,
            },
          }
        }

        return nextInspections
      })
      setStatus(
        result.operationLogPath
          ? `Local edit applied. Operation log: ${result.operationLogPath}`
          : 'Local edit applied.',
      )
      onApplied?.()
    } catch (applyError) {
      setError(errorMessage(applyError, 'Apply failed.'))
    } finally {
      setIsPending(false)
    }
  }

  function handleTargetPathChange(ownedItemId: string, targetPath: string) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.ownedItemId === ownedItemId
          ? { ...currentDraft, targetPath }
          : currentDraft,
      ),
    )
    setValidation(null)
  }

  function handleTargetTagsChange(
    ownedItemId: string,
    targetTags: LocalEditTags,
  ) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.ownedItemId === ownedItemId
          ? { ...currentDraft, targetTags }
          : currentDraft,
      ),
    )
    clearValidationState()
  }

  function handleAutofillTags(ownedItemId?: string) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        !ownedItemId || currentDraft.ownedItemId === ownedItemId
          ? {
              ...currentDraft,
              targetTags: normalizeTagDraft(currentDraft.tags),
            }
          : currentDraft,
      ),
    )
    clearValidationState()
  }

  function handleReleaseFolderChange(nextReleaseFolder: string) {
    setDrafts((currentDrafts) => {
      const currentTargetRoot = commonDirectory(
        currentDrafts.map((draft) => directoryName(draft.targetPath)),
      )

      return currentDrafts.map((draft) => {
        const targetDirectory = directoryName(draft.targetPath)
        const targetFileName = fileName(draft.targetPath)
        const relativeDirectory = relativePath(
          currentTargetRoot,
          targetDirectory,
        )

        return {
          ...draft,
          targetPath: joinPath(
            nextReleaseFolder,
            relativeDirectory,
            targetFileName,
          ),
        }
      })
    })
    setValidation(null)
  }

  function clearValidationState() {
    setValidation(null)
    setStatus('')
    setError('')
  }

  return (
    <section
      className="panel local-file-edit-panel"
      aria-label="Local file editor"
      role="region"
    >
      <div className="panel-heading local-file-edit-heading">
        <div>
          <h2>Local file editor</h2>
          <p>{files.length === 1 ? files[0].title : `${files.length} files`}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close local file editor"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <ModeTabs activeMode={activeMode} onModeChange={handleModeChange} />

      {activeMode === 'fileNames' ? (
        <>
          <NamingProfileToolbar
            profiles={profiles}
            selectedProfile={selectedProfile}
            selectedProfileId={selectedProfileId}
            onProfileChange={applyProfile}
          />
          {drafts.length > 1 ? (
            <ReleaseBatchEditor
              currentReleaseFolder={currentReleaseFolder}
              rows={proposedRows}
              targetReleaseFolder={targetReleaseFolder}
              unchangedCount={unchangedCount}
              validationIssues={validationIssues}
              validationState={validation}
              renameCount={renameCount}
              onTargetReleaseFolderChange={handleReleaseFolderChange}
            />
          ) : (
            <SingleFileEditor
              draft={drafts[0]}
              inspection={inspections[drafts[0]?.ownedItemId]}
              rows={proposedRows}
              validationIssues={validationIssues}
              validationState={validation}
              onTargetPathChange={handleTargetPathChange}
            />
          )}
        </>
      ) : (
        <TagEditMode
          drafts={drafts}
          inspections={inspections}
          selectedOwnedItemId={selectedTagOwnedItemId}
          tagChangesByOwnedItemId={tagChangesByOwnedItemId}
          tagUnchangedCount={tagUnchangedCount}
          tagUpdateCount={tagUpdateCount}
          onAutofillTags={handleAutofillTags}
          onSelectedOwnedItemChange={setSelectedTagOwnedItemId}
          onTargetTagsChange={handleTargetTagsChange}
        />
      )}
      {status ? <p role="status">{status}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <div className="local-file-edit-actions">
        <p>{applyHelpText(activeMode)}</p>
        <button
          className="button button-primary"
          disabled={isPending || actionableRequest.files.length === 0}
          type="button"
          onClick={() => {
            void handleApply()
          }}
        >
          <Save size={16} />
          {activeMode === 'fileNames' ? 'Apply file names' : 'Apply tags'}
        </button>
      </div>
    </section>
  )
}

function ModeTabs({
  activeMode,
  onModeChange,
}: {
  activeMode: LocalEditMode
  onModeChange: (mode: LocalEditMode) => void
}) {
  return (
    <div className="local-file-edit-mode-tabs" role="tablist">
      <button
        aria-selected={activeMode === 'fileNames'}
        className="local-file-edit-mode-tab"
        role="tab"
        type="button"
        onClick={() => onModeChange('fileNames')}
      >
        File names
      </button>
      <button
        aria-selected={activeMode === 'tags'}
        className="local-file-edit-mode-tab"
        role="tab"
        type="button"
        onClick={() => onModeChange('tags')}
      >
        Tags
      </button>
    </div>
  )
}

function NamingProfileToolbar({
  onProfileChange,
  profiles,
  selectedProfile,
  selectedProfileId,
}: {
  onProfileChange: (profileId: string) => void
  profiles: NamingProfile[]
  selectedProfile?: NamingProfile
  selectedProfileId: string
}) {
  return (
    <div className="local-file-edit-toolbar">
      <label className="local-file-edit-field">
        <span>Naming profile</span>
        <select
          value={selectedProfileId}
          onChange={(event) => onProfileChange(event.currentTarget.value)}
        >
          <option value="">No profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      {selectedProfile ? (
        <ProfileTemplateSummary profile={selectedProfile} />
      ) : null}
    </div>
  )
}

function renameRequest(draft: LocalEditableFileDraft) {
  const rename =
    normalizePath(draft.currentPath) !== normalizePath(draft.targetPath)

  return rename
    ? [
        {
          ownedItemId: draft.ownedItemId,
          currentPath: draft.currentPath,
          targetPath: draft.targetPath,
        },
      ]
    : []
}

function tagRequest(
  draft: LocalEditableFileDraft,
  tagChangesByOwnedItemId: Map<string, LocalEditTags>,
) {
  const tagChanges = tagChangesByOwnedItemId.get(draft.ownedItemId) ?? {}

  return hasTagValues(tagChanges)
    ? [
        {
          ownedItemId: draft.ownedItemId,
          currentPath: draft.currentPath,
          targetPath: draft.currentPath,
          tags: tagChanges,
        },
      ]
    : []
}
