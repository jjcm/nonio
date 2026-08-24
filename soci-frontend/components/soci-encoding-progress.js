import SociComponent from './soci-component.js'

export default class SociEncodingProgress extends SociComponent {
  constructor() {
    super()
  }

  css(){
    return `
      :host { width: 420px; display: block; margin: 0 auto; padding: 40px 0; }
      .info { font-weight: 500; color: var(--text-secondary); margin-bottom: 12px; text-align: center; }
      columns { display: flex; }
      column { width: 100%; display: flex; flex-direction: column; align-items: flex-end; }
      .fidelity {
        line-height: 24px;
        width: 152px;
        display: flex;
        margin-bottom: 8px;
        transition: opacity 0.3s var(--soci-ease);
        &[disabled] { opacity: 0.3; }
        span { color: var(--text-brand); font-size: 11px; position: relative; top: -4px; left: 6px; }
      }
      soci-radial-progress { margin-right: 10px; }
    `
  }

  html(){ 
    return `
      <div class="info">encoding video...</div>
      <columns>
        <column>
          <div class="fidelity" resolution="4320p" disabled>
            <soci-radial-progress percent="0"></soci-radial-progress>
            <div class="resolution">8k or higher</div>
          </div>
          <div class="fidelity" resolution="2160p" disabled>
            <soci-radial-progress percent="0"></soci-radial-progress>
            <div class="resolution">2160p</div>
          </div>
          <div class="fidelity" resolution="1440p" disabled>
            <soci-radial-progress percent="0"></soci-radial-progress>
            <div class="resolution">1440p</div>
          </div>
        </column>
        <column>
          <div class="fidelity" resolution="1080p" disabled>
            <soci-radial-progress percent="0" waiting></soci-radial-progress>
            <div class="resolution">1080p</div>
          </div>
          <div class="fidelity" resolution="720p" disabled>
            <soci-radial-progress percent="0"></soci-radial-progress>
            <div class="resolution">720p</div>
          </div>
          <div class="fidelity" resolution="480p" disabled>
            <soci-radial-progress percent="0" waiting></soci-radial-progress>
            <div class="resolution">480p</div>
          </div>
        </column>
      </columns>
    `
  }

  connectedCallback(){
    // Store reference to this component for progress updates
    this._equivalentResolution = '480p'
    this._firstResolutionReceived = false
    this._firstProgressReceived = false
  }

  // Method to update resolution info (called from parent)
  setResolution(width, height) {
    console.log('[SociEncodingProgress] setResolution called:', width, height)
    const resolution = Math.max(width, height)
    this._equivalentResolution = '480p'
    const resolutionBreakpoints = {
      "480p": 0,
      "720p": 1067,
      "1080p": 1600,
      "1440p": 2240,
      "2160p": 3200,
      "4320p": 5760
    }
    
    // Determine the source resolution
    for(let res in resolutionBreakpoints) {
      if(resolution > resolutionBreakpoints[res]) {
        this._equivalentResolution = res
        this.select(`[resolution="${res}"]`)?.toggleAttribute('disabled', false)
      }
    }
    console.log('[SociEncodingProgress] Equivalent resolution:', this._equivalentResolution)
    const fidelity = this.select(`[resolution="${this._equivalentResolution}"] .resolution`)
    if(fidelity) {
      fidelity.innerHTML += '<span>source</span>'
    }
    
    // If this is the first resolution message and we're already encoding a higher resolution,
    // mark all lower resolutions as complete (100%)
    if(!this._firstResolutionReceived) {
      console.log('[SociEncodingProgress] First resolution received, checking for lower resolutions to mark complete')
      this._firstResolutionReceived = true
      this._markLowerResolutionsComplete()
    }
  }
  
  // Mark all resolutions lower than the current encoding resolution as complete
  _markLowerResolutionsComplete() {
    console.log('[SociEncodingProgress] _markLowerResolutionsComplete called')
    // This method is called when we receive the resolution message
    // At this point, we need to check if any progress updates have already come in
    // If so, we can infer which resolution is currently encoding
    const resolutionOrder = ['480p', '720p', '1080p', '1440p', '2160p', '4320p']
    
    // Find the first resolution that has progress (meaning encoding has started)
    // We'll mark all resolutions before the first one with progress as complete
    let firstActiveIndex = -1
    for(let i = 0; i < resolutionOrder.length; i++) {
      const res = resolutionOrder[i]
      const progress = this.select(`[resolution="${res}"] soci-radial-progress`)
      if(progress) {
        console.log(`[SociEncodingProgress] Checking ${res}: percent = ${progress.percent}`)
        if(progress.percent > 0) {
          firstActiveIndex = i
          console.log(`[SociEncodingProgress] Found first active resolution: ${res} at index ${i}`)
          break
        }
      }
    }
    
    // If we found an active resolution, mark all lower ones as complete
    if(firstActiveIndex > 0) {
      console.log(`[SociEncodingProgress] Marking resolutions 0-${firstActiveIndex-1} as complete`)
      for(let i = 0; i < firstActiveIndex; i++) {
        const res = resolutionOrder[i]
        const progress = this.select(`[resolution="${res}"] soci-radial-progress`)
        if(progress && progress.percent === 0) {
          console.log(`[SociEncodingProgress] Marking ${res} as 100% complete`)
          progress.toggleAttribute('waiting', false)
          progress.percent = 100
        }
      }
    } else {
      console.log('[SociEncodingProgress] No active resolution found, nothing to mark as complete')
    }
  }

  // Method to update progress for a specific resolution
  updateProgress(resolution, percent) {
    console.log(`[SociEncodingProgress] updateProgress called: resolution=${resolution}, percent=${percent}, _firstProgressReceived=${this._firstProgressReceived}`)
    const res = resolution === 'source' ? this._equivalentResolution : resolution
    console.log(`[SociEncodingProgress] Resolved resolution: ${res}`)
    const progress = this.select(`[resolution="${res}"] soci-radial-progress`)
    if(progress) {
      progress.toggleAttribute('waiting', false)
      progress.percent = percent
      console.log(`[SociEncodingProgress] Updated ${res} progress to ${percent}%`)
      
      // If this is the first progress update we receive, check if we need to mark lower resolutions as complete
      if(!this._firstProgressReceived) {
        console.log(`[SociEncodingProgress] First progress update received for ${res}, checking if lower resolutions should be marked complete`)
        this._firstProgressReceived = true
        
        // Always try to mark lower resolutions as complete when we get the first update
        // This handles the case where we join mid-encoding
        this._markLowerResolutionsCompleteFromCurrent(res)
      }
    } else {
      console.warn(`[SociEncodingProgress] Could not find progress element for resolution: ${res}`)
    }
  }
  
  // Mark all resolutions lower than the given resolution as complete
  // This is called when we receive the first progress update for a resolution
  // Encoding always happens in order: 480p -> 720p -> 1080p -> 1440p -> 2160p -> source
  // So if we're encoding a higher resolution, all lower ones must be complete
  _markLowerResolutionsCompleteFromCurrent(currentRes) {
    console.log(`[SociEncodingProgress] _markLowerResolutionsCompleteFromCurrent called with: ${currentRes}`)
    const resolutionOrder = ['480p', '720p', '1080p', '1440p', '2160p', '4320p']
    const currentIndex = resolutionOrder.indexOf(currentRes)
    console.log(`[SociEncodingProgress] Current resolution index: ${currentIndex}`)
    
    // If we're encoding a resolution that's not the first one (480p),
    // all lower resolutions must be complete
    if(currentIndex > 0) {
      console.log(`[SociEncodingProgress] Marking resolutions 0-${currentIndex-1} as complete`)
      for(let i = 0; i < currentIndex; i++) {
        const res = resolutionOrder[i]
        const progress = this.select(`[resolution="${res}"] soci-radial-progress`)
        if(progress) {
          console.log(`[SociEncodingProgress] Checking ${res}: current percent = ${progress.percent}`)
          // Mark as complete regardless of current percent - if we're encoding a higher res,
          // the lower ones must be done
          console.log(`[SociEncodingProgress] Marking ${res} as 100% complete`)
          progress.toggleAttribute('waiting', false)
          progress.percent = 100
        } else {
          console.warn(`[SociEncodingProgress] Could not find progress element for ${res}`)
        }
      }
    } else {
      console.log(`[SociEncodingProgress] Current resolution is 480p (index 0), nothing to mark as complete`)
    }
  }
}

