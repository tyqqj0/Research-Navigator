/**
 * Venue Quality Scorer
 * 
 * Calculates venue quality scores based on CCF (China Computer Federation) rankings.
 * Supports CCF-A, CCF-B, and CCF-C tier conferences and journals.
 */

// ============================================================================
// CCF-A Tier Venues (Top-tier: Score 1.0)
// Each entry can be abbreviation or keywords from full name
// ============================================================================

const CCF_A_CONFERENCES = [
    // AI & ML
    'AAAI',
    'AAAI Conference on Artificial Intelligence',
    'CVPR',
    'IEEE Conference on Computer Vision and Pattern Recognition',
    'ICCV',
    'International Conference on Computer Vision',
    'ICML',
    'International Conference on Machine Learning',
    'IJCAI',
    'International Joint Conference on Artificial Intelligence',
    'NEURIPS',
    'NIPS',
    'Conference on Neural Information Processing Systems',
    'ACL',
    'Annual Meeting of the Association for Computational Linguistics',
    'ICLR',
    'International Conference on Learning Representations',
    'IROS',
    'IEEE/RSJ International Conference on Intelligent Robots and Systems',
    
    // Database & Data Mining & Information Retrieval
    'SIGMOD',
    'ACM Conference on Management of Data',
    'SIGKDD',
    'KDD',
    'ACM Knowledge Discovery and Data Mining',
    'SIGIR',
    'ACM SIGIR Conference on Research and Development in Information Retrieval',
    'VLDB',
    'International Conference on Very Large Data Bases',
    'ICDE',
    'IEEE International Conference on Data Engineering',
    
    // Networks
    'SIGCOMM',
    'ACM International Conference on Data Communication',
    'MOBICOM',
    'ACM International Conference on Mobile Computing and Networking',
    'INFOCOM',
    'IEEE International Conference on Computer Communications',
    'NSDI',
    'USENIX Symposium on Networked Systems Design and Implementation',
    
    // Systems & Architecture
    'OSDI',
    'USENIX Symposium on Operating Systems Design and Implementation',
    'SOSP',
    'ACM Symposium on Operating Systems Principles',
    'ASPLOS',
    'Architectural Support for Programming Languages and Operating Systems',
    'ISCA',
    'International Symposium on Computer Architecture',
    'MICRO',
    'IEEE/ACM International Symposium on Microarchitecture',
    'ATC',
    'USENIX Annual Technical Conference',
    
    // Software Engineering
    'ICSE',
    'International Conference on Software Engineering',
    'FSE',
    'ESEC',
    'ACM SIGSOFT Symposium on Foundations of Software Engineering',
    'ASE',
    'IEEE/ACM International Conference on Automated Software Engineering',
    
    // WWW & Internet
    'WWW',
    'International World Wide Web Conference',
    'RTSS',
    'IEEE Real-Time Systems Symposium',
];

const CCF_A_JOURNALS = [
    // AI & ML
    'TPAMI',
    'PAMI',
    'IEEE Transactions on Pattern Analysis and Machine Intelligence',
    'IJCV',
    'International Journal of Computer Vision',
    'JMLR',
    'Journal of Machine Learning Research',
    'AIJ',
    'Artificial Intelligence Journal',
    'TACL',
    'Transactions of the Association for Computational Linguistics',
    
    // Database & Information Systems
    'TODS',
    'ACM Transactions on Database Systems',
    'TOIS',
    'ACM Transactions on Information Systems',
    'TKDE',
    'IEEE Transactions on Knowledge and Data Engineering',
    'VLDB Journal',
    'The VLDB Journal',
    
    // Prestigious general science
    'Nature',
    'Science',
    'PNAS',
    'Proceedings of the National Academy of Sciences',
    'CACM',
    'Communications of the ACM',
    'JACM',
    'Journal of the ACM',
    'Proceedings of the IEEE',
    'Nature Machine Intelligence',
    'Nature Communications',
];

// ============================================================================
// CCF-B Tier Venues (High-quality: Score 0.72)
// ============================================================================

const CCF_B_CONFERENCES = [
    // AI & ML
    'ECCV',
    'European Conference on Computer Vision',
    'EMNLP',
    'Empirical Methods in Natural Language Processing',
    'ECAI',
    'European Conference on Artificial Intelligence',
    'COLT',
    'Annual Conference on Learning Theory',
    'AISTATS',
    'Artificial Intelligence and Statistics',
    'CONLL',
    'Conference on Computational Natural Language Learning',
    'UAI',
    'Conference on Uncertainty in Artificial Intelligence',
    'ICAPS',
    'International Conference on Automated Planning and Scheduling',
    'COLING',
    'International Conference on Computational Linguistics',
    'NAACL',
    'North American Chapter of the Association for Computational Linguistics',
    
    // Database & Data Mining
    'CIKM',
    'ACM International Conference on Information and Knowledge Management',
    'WSDM',
    'ACM International Conference on Web Search and Data Mining',
    'PODS',
    'ACM Symposium on Principles of Database Systems',
    'DASFAA',
    'Database Systems for Advanced Applications',
    'ECML',
    'PKDD',
    'ECML-PKDD',
    'European Conference on Machine Learning and Knowledge Discovery',
    
    // Systems
    'EUROSYS',
    'European Conference on Computer Systems',
    'FAST',
    'USENIX Conference on File and Storage Technologies',
    'HPCA',
    'IEEE International Symposium on High Performance Computer Architecture',
    'USENIX Security',
    'USENIX Security Symposium',
    'SENSYS',
    'ACM Conference on Embedded Networked Sensor Systems',
    
    // Web & Social
    'RECSYS',
    'ACM Conference on Recommender Systems',
    'ISWC',
    'International Semantic Web Conference',
    'ICWSM',
    'International AAAI Conference on Web and Social Media',
    'CONEXT',
    'ACM Conference on Emerging Network Experiment and Technology',
    'IMC',
    'ACM Internet Measurement Conference',
    
    // Software Engineering
    'ISSTA',
    'International Symposium on Software Testing and Analysis',
    'ICSME',
    'IEEE International Conference on Software Maintenance and Evolution',
    'MSR',
    'Mining Software Repositories',
];

// ============================================================================
// CCF-C Tier Venues (Regular: Score 0.48)
// ============================================================================

const CCF_C_CONFERENCES = [
    // AI
    'ACCV',
    'Asian Conference on Computer Vision',
    'CORL',
    'Conference on Robot Learning',
    'ICANN',
    'International Conference on Artificial Neural Networks',
    'PRICAI',
    'Pacific Rim International Conference on Artificial Intelligence',
    
    // Database
    'APWEB',
    'Asia Pacific Web Conference',
    'DEXA',
    'Database and Expert Systems Applications',
    'ECIR',
    'European Conference on Information Retrieval',
    
    // Networks
    'ICNP',
    'IEEE International Conference on Network Protocols',
];

// ============================================================================
// Venue Matching & Scoring Logic
// ============================================================================

/**
 * Normalize venue string for matching
 */
function normalizeVenue(venue: string): string {
    return venue
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars
        .replace(/\s+/g, ' ')           // Collapse whitespace
        .trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if venue matches any item in the list
 * Supports both abbreviations (CVPR) and full names (Computer Vision and Pattern Recognition)
 */
function matchesVenueList(normalized: string, venueList: string[]): boolean {
    return venueList.some(v => {
        const vNorm = v.toLowerCase();
        
        // For short abbreviations (≤5 chars), use word boundary matching for precision
        // e.g., "CVPR" should match "cvpr 2024" but not "ecvpr"
        if (vNorm.length <= 5 && !/\s/.test(vNorm)) {
            try {
                const escaped = escapeRegex(vNorm);
                const regex = new RegExp(`\\b${escaped}\\b`);
                return regex.test(normalized);
            } catch {
                // Fallback to simple includes if regex fails
                return normalized.includes(vNorm);
            }
        }
        
        // For longer names or multi-word phrases, use substring matching
        // e.g., "computer vision and pattern recognition" should match
        // "IEEE Conference on Computer Vision and Pattern Recognition"
        return normalized.includes(vNorm);
    });
}

/**
 * Calculate venue quality score based on CCF rankings
 * 
 * @param venue - Venue name/string from paper metadata
 * @returns Normalized score (0-1):
 *   - 1.0: CCF-A (25 points)
 *   - 0.72: CCF-B (18 points)
 *   - 0.48: CCF-C (12 points)
 *   - 0.24: Other academic venue (6 points)
 *   - 0: Unknown/arXiv/preprint
 */
export function calculateVenueScore(venue?: string): number {
    if (!venue) {
        return 0;
    }

    const normalized = normalizeVenue(venue);

    // Special cases: filter out non-peer-reviewed venues
    if (
        normalized.includes('arxiv') ||
        normalized.includes('preprint') ||
        normalized === ''
    ) {
        return 0;
    }

    // Special cases: downgrade workshops and posters
    const isWorkshop = normalized.includes('workshop');
    const isPosterOrDemo = normalized.includes('poster') || normalized.includes('demo');

    // Check CCF-A tier
    if (
        matchesVenueList(normalized, CCF_A_CONFERENCES) ||
        matchesVenueList(normalized, CCF_A_JOURNALS)
    ) {
        // Workshops at top venues are still capped at CCF-C score
        if (isWorkshop) return 0.48;
        if (isPosterOrDemo) return 0.40;
        return 1.0;
    }

    // Check CCF-B tier
    if (matchesVenueList(normalized, CCF_B_CONFERENCES)) {
        if (isWorkshop) return 0.48;
        if (isPosterOrDemo) return 0.40;
        return 0.72;
    }

    // Check CCF-C tier
    if (matchesVenueList(normalized, CCF_C_CONFERENCES)) {
        if (isWorkshop) return 0.48;
        if (isPosterOrDemo) return 0.40;
        return 0.48;
    }

    // If venue string exists but doesn't match any known venue,
    // assume it's a regular academic venue (not a top-tier one)
    // Give modest credit for being published somewhere
    if (isWorkshop) return 0.30;
    if (isPosterOrDemo) return 0.20;
    
    // Check if it looks like a conference/journal (has typical keywords)
    const hasConferenceKeywords = /conference|proceedings|symposium|international|workshop|journal|transactions/.test(normalized);
    if (hasConferenceKeywords) {
        return 0.24;  // Other academic venue (6 points)
    }

    // Unknown venue
    return 0;
}

/**
 * Get venue tier name for display purposes
 */
export function getVenueTier(venue?: string): string {
    if (!venue) return 'Unknown';
    
    const normalized = normalizeVenue(venue);
    
    if (normalized.includes('arxiv') || normalized.includes('preprint')) {
        return 'Preprint';
    }
    
    if (
        matchesVenueList(normalized, CCF_A_CONFERENCES) ||
        matchesVenueList(normalized, CCF_A_JOURNALS)
    ) {
        return 'CCF-A';
    }
    
    if (matchesVenueList(normalized, CCF_B_CONFERENCES)) {
        return 'CCF-B';
    }
    
    if (matchesVenueList(normalized, CCF_C_CONFERENCES)) {
        return 'CCF-C';
    }
    
    return 'Other';
}

