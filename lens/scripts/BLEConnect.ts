// @input Asset.BluetoothCentralModule bluetooth

let gatt = null;

async function connectFirstControllerNamed(nameSubstr: string) {
  const scanFilter = new Bluetooth.ScanFilter();
  // You can leave fields empty and filter in predicate; ScanFilter has deviceName too.
  const settings = new Bluetooth.ScanSettings();
  settings.timeoutSeconds = 20;
  settings.scanMode = Bluetooth.ScanMode.LowPower;

  const result = await script.bluetooth.startScan(
    [scanFilter],
    settings,
    function (r) {
      // ScanResult has deviceName/deviceAddress per docs
      const name = r.deviceName || "";
      print("saw: " + name);
      return name.toLowerCase().indexOf(nameSubstr) >= 0 && r.isConnectable;
    }
  );

  print("Connecting to " + result.deviceName);
  gatt = await script.bluetooth.connectGatt(result.deviceAddress);

  gatt.onConnectionStateChangedEvent.add((ev) => {
    print("BLE state: " + ev.state);
  });

  // List services & characteristics so you can identify HID service/characteristics
  const services = gatt.getServices();
  print("services: " + services.length);
  services.forEach((s) => {
    const chars = s.getCharacteristics();
    print("svc " + s.uuid + " chars:" + chars.length);
  });

  // For full button mapping: import Snap's BLE Game Controller sample and use its scripts
  // to interpret HID reports, then call global.Nav.nextStep(), global.Nav.prevStep(), etc.
}

script.createEvent("OnStartEvent").bind(() => {
  // Pick a substring likely in pad name, e.g. "xbox" / "dual" / "pro"
  connectFirstControllerNamed("xbox")
    .then(()=>print("scan done"))
    .catch((e)=>print("BLE error: " + e));
});
