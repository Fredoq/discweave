import type { ExternalOriginalTrackDiscoveryCandidate } from './originalTrackDiscoveryPresentation'
import {
  candidateInferenceLabel,
  candidateRoleLabel,
  discoveryPathLabel,
  inferenceCompletionLabel,
} from './originalTrackDiscoveryEvidence'

export function OriginalTrackDiscoveryInference({
  candidate,
}: Readonly<{
  candidate: ExternalOriginalTrackDiscoveryCandidate
}>) {
  if (candidate.externalCandidate === null) return null

  const paths = candidate.discoveryPaths
  return (
    <section
      aria-label="Inference details"
      className="original-track-discovery-inference"
    >
      <div className="original-track-discovery-inference-heading">
        <span>Inference</span>
        <strong>{candidateRoleLabel(candidate.candidateRole)}</strong>
      </div>
      <p>{candidateInferenceLabel(candidate.candidateRole)}</p>
      <p>{inferenceCompletionLabel(candidate.inferenceComplete)}</p>
      {paths.length > 0 ? (
        <div className="original-track-discovery-inference-paths">
          <span>Routes checked</span>
          <ul>
            {paths.map((path) => (
              <li key={path}>{discoveryPathLabel(path)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
