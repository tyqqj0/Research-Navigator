import type { PaperMetadata, QualityWeights, ScoreComponents } from '../ports/types';
import { calculateVenueScore } from './venue-scorer';

function computeAgeYears(metadata: PaperMetadata): number {
    const currentYear = new Date().getFullYear();
    let ageYears = 1;
    if (metadata.year) {
        ageYears = Math.max(1, currentYear - (metadata.year || currentYear) + 1);
    } else if (metadata.publicationDate) {
        try {
            const pubDate = new Date(metadata.publicationDate);
            const ageMs = Date.now() - pubDate.getTime();
            ageYears = Math.max(1, ageMs / (365.25 * 24 * 60 * 60 * 1000));
        } catch {
            ageYears = 1;
        }
    }
    return ageYears;
}

export function calculateQualityScore(metadata: PaperMetadata, weights: Required<QualityWeights>): { score: number; components: ScoreComponents } {
    const ageYears = computeAgeYears(metadata);

    const influential = (metadata.influentialCitationCount || metadata.citationCount || 0);
    const s1 = Math.log(1 + influential) / Math.pow(ageYears, weights.alpha);
    const s2 = Math.exp(-ageYears / weights.tau);
    const s3 = 0; // placeholder until citation velocity is available
    const s4 = calculateVenueScore(metadata.venue || undefined);

    const score = (
        (weights.influentialPerYear * s1) +
        (weights.recency * s2) +
        (weights.velocity * s3) +
        (weights.venue * s4)
    );

    const components: ScoreComponents = {
        influentialPerYear: s1,
        recency: s2,
        velocity: s3,
        venue: s4
    };

    return { score, components };
}




