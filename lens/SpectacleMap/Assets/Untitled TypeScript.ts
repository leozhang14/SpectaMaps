// Navigation Manager - GPS + Destination Targeting
// Uses verified GPS APIs + standard mathematical calculations

require('LensStudio:RawLocationModule');

@component
export class NavigationManager extends BaseScriptComponent {
    
    // INSPECTOR INPUTS - Set these in Lens Studio Inspector
    @input
    destinationLatitude: number = 43.4720; // Example: University of Waterloo
    
    @input
    destinationLongitude: number = -80.5449;
    
    @input
    updateIntervalSeconds: number = 1.0; // How often to update
    
    @input
    arrivalThresholdMeters: number = 10.0; // Consider "arrived" when within this distance
    
    @input
    enableDebugOutput: boolean = true; // Show detailed console output
    
    // GPS tracking variables
    private locationService: LocationService;
    private repeatUpdateUserLocation: DelayedCallbackEvent;
    
    // Current location data
    private currentLatitude: number = 0;
    private currentLongitude: number = 0;
    private currentAccuracy: number = 999;
    private timestamp: Date;
    private locationSource: string = '';
    
    // Navigation state
    private isNavigating: boolean = false;
    private hasArrived: boolean = false;
    
    onAwake() {
        // Start GPS tracking when script loads
        this.createEvent('OnStartEvent').bind(() => {
            this.initializeNavigation();
        });
        
        // Set up repeating GPS updates
        this.repeatUpdateUserLocation = this.createEvent('DelayedCallbackEvent');
        this.repeatUpdateUserLocation.bind(() => {
            this.updateLocationAndNavigation();
        });
    }
    
    /**
     * Initialize GPS and start navigation
     */
    private initializeNavigation() {
        try {
            // Create location service
            this.locationService = GeoLocation.createLocationService();
            this.locationService.accuracy = GeoLocationAccuracy.Navigation;
            
            print("Navigation system initialized");
            print("Destination: " + this.destinationLatitude + ", " + this.destinationLongitude);
            print("Go outside for GPS signal");
            
            // Start navigation loop
            this.isNavigating = true;
            this.updateLocationAndNavigation();
            
        } catch (error) {
            print("ERROR: Navigation initialization failed: " + error);
        }
    }
    
    /**
     * Update GPS and calculate navigation
     */
    private updateLocationAndNavigation() {
        if (!this.locationService || !this.isNavigating) {
            this.repeatUpdateUserLocation.reset(this.updateIntervalSeconds);
            return;
        }
        
        this.locationService.getCurrentPosition(
            (geoPosition) => {
                // Update GPS data
                this.currentLatitude = geoPosition.latitude;
                this.currentLongitude = geoPosition.longitude;
                this.currentAccuracy = geoPosition.horizontalAccuracy;
                this.timestamp = geoPosition.timestamp;
                this.locationSource = geoPosition.locationSource;
                
                // Calculate navigation
                this.calculateAndDisplayNavigation();
                
                // Schedule next update
                this.repeatUpdateUserLocation.reset(this.updateIntervalSeconds);
            },
            (error) => {
                print("GPS Error: " + error);
                print("Make sure you're outside with clear sky view");
                this.repeatUpdateUserLocation.reset(5.0);
            }
        );
    }
    
    /**
     * Calculate bearing and distance to destination, display navigation info
     */
    private calculateAndDisplayNavigation() {
        if (this.currentLatitude === 0 || this.currentLongitude === 0) {
            print("Waiting for GPS fix...");
            return;
        }
        
        // Calculate distance to destination (meters)
        const distanceToDestination = this.calculateDistance(
            this.currentLatitude, this.currentLongitude,
            this.destinationLatitude, this.destinationLongitude
        );
        
        // Calculate bearing to destination (degrees)
        const bearingToDestination = this.calculateBearing(
            this.currentLatitude, this.currentLongitude,
            this.destinationLatitude, this.destinationLongitude
        );
        
        // Check if arrived
        if (distanceToDestination <= this.arrivalThresholdMeters && !this.hasArrived) {
            this.handleArrival();
            return;
        }
        
        // Display navigation information
        if (this.enableDebugOutput) {
            print("=== NAVIGATION UPDATE ===");
            print("Current: " + this.currentLatitude.toFixed(6) + ", " + this.currentLongitude.toFixed(6));
            print("Accuracy: " + this.currentAccuracy.toFixed(1) + "m");
            print("Distance to destination: " + distanceToDestination.toFixed(1) + "m");
            print("Bearing to destination: " + bearingToDestination.toFixed(1) + " degrees");
            print("Direction: " + this.bearingToDirection(bearingToDestination));
            print("========================");
        } else {
            // Simplified output
            print("Distance: " + distanceToDestination.toFixed(1) + "m | Direction: " + this.bearingToDirection(bearingToDestination));
        }
    }
    
    /**
     * Calculate distance between two GPS points using Haversine formula
     * Returns distance in meters
     */
    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    /**
     * Calculate compass bearing from current location to destination
     * Returns bearing in degrees (0-360, where 0 = North)
     */
    private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360; // Normalize to 0-360
        
        return bearing;
    }
    
    /**
     * Convert bearing degrees to readable direction
     */
    private bearingToDirection(bearing: number): string {
        const directions = [
            "North", "North-Northeast", "Northeast", "East-Northeast",
            "East", "East-Southeast", "Southeast", "South-Southeast", 
            "South", "South-Southwest", "Southwest", "West-Southwest",
            "West", "West-Northwest", "Northwest", "North-Northwest"
        ];
        
        const index = Math.round(bearing / 22.5) % 16;
        return directions[index] + " (" + bearing.toFixed(1) + "°)";
    }
    
    /**
     * Handle arrival at destination
     */
    private handleArrival() {
        this.hasArrived = true;
        print("*** DESTINATION REACHED ***");
        print("You have arrived at your destination!");
        print("*************************");
        
        // Stop navigation updates
        this.isNavigating = false;
    }
    
    /**
     * Set a new destination and restart navigation
     */
    public setNewDestination(latitude: number, longitude: number) {
        this.destinationLatitude = latitude;
        this.destinationLongitude = longitude;
        this.hasArrived = false;
        this.isNavigating = true;
        
        print("New destination set: " + latitude + ", " + longitude);
    }
    
    /**
     * Get current navigation status
     */
    public getNavigationStatus(): {
        currentLat: number,
        currentLng: number,
        destinationLat: number,
        destinationLng: number,
        distance: number,
        bearing: number,
        hasArrived: boolean
    } {
        const distance = this.calculateDistance(
            this.currentLatitude, this.currentLongitude,
            this.destinationLatitude, this.destinationLongitude
        );
        
        const bearing = this.calculateBearing(
            this.currentLatitude, this.currentLongitude,
            this.destinationLatitude, this.destinationLongitude
        );
        
        return {
            currentLat: this.currentLatitude,
            currentLng: this.currentLongitude,
            destinationLat: this.destinationLatitude,
            destinationLng: this.destinationLongitude,
            distance: distance,
            bearing: bearing,
            hasArrived: this.hasArrived
        };
    }
}