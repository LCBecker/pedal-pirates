import "./App.css";

import { useState } from "react";

/**
 * Represents the decoded Cycling Speed and Cadence (CSC) Measurement characteristic.
 */
type CSCMeasurement = {
  /** Indicates if wheel revolution data is present in the characteristic. */
  wheelRevolutionDataPresent?: boolean;
  /** Indicates if crank revolution data is present in the characteristic. */
  crankRevolutionDataPresent?: boolean;
  /**
   * The total number of wheel revolutions since the last reset.
   * This value is present only if `wheelRevolutionDataPresent` is true.
   */
  cumulativeWheelRevolutions?: number;
  /**
   * The time of the last wheel revolution event in 1/1024 seconds.
   * This value is present only if `wheelRevolutionDataPresent` is true.
   */
  lastWheelEventTime?: number;
  /**
   * The total number of crank revolutions since the last reset.
   * This value is present only if `crankRevolutionDataPresent` is true.
   */
  cumulativeCrankRevolutions?: number;
  /**
   * The time of the last crank revolution event in 1/1024 seconds.
   * This value is present only if `crankRevolutionDataPresent` is true.
   */
  lastCrankEventTime?: number;
  /** Calculated RPM based on changes in crank revolutions and time. */
  rpm?: number;
  /** Calculated speed in km/h based on changes in wheel revolutions, time, and wheel circumference. */
  speedKmH?: number;
};

function App() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  let previousMeasurement: CSCMeasurement | null = null;

  // Tacx Bluetooth business Id: 0x0689. See more: https://btprodspecificationrefs.blob.core.windows.net/assigned-numbers/Assigned%20Number%20Types/Assigned_Numbers.pdf

  // Characteristics UUIDs sourced from https://gist.github.com/sam016/4abe921b5a9ee27f67b3686910293026
  // attributes.put("00002a63-0000-1000-8000-00805f9b34fb", "Cycling Power Measurement");
  //       attributes.put("00002a64-0000-1000-8000-00805f9b34fb", "Cycling Power Vector");
  //       attributes.put("00002a65-0000-1000-8000-00805f9b34fb", "Cycling Power Feature");
  //       attributes.put("00002a66-0000-1000-8000-00805f9b34fb", "Cycling Power Control Point");
  // attributes.put("00001816-0000-1000-8000-00805f9b34fb", "Cycling Speed and Cadence");
  //       attributes.put("00001818-0000-1000-8000-00805f9b34fb", "Cycling Power");
  //       {
  //         "id": "org.bluetooth.service.cycling_speed_and_cadence",
  //         "name": "Cycling Speed and Cadence",
  //         "code": "0x1816",
  //         "specification": "GSS"
  //       },
  //       {
  //         "id": "org.bluetooth.service.cycling_power",
  //         "name": "Cycling Power",
  //         "code": "0x1818",
  //         "specification": "GSS"
  //       },

  // Requesting any Bluetooth Device...
  // Connecting to GATT Server...
  // Getting Services...
  // Getting Characteristics...
  // > Service: 00001818-0000-1000-8000-00805f9b34fb
  // >> Characteristic: 00002a5d-0000-1000-8000-00805f9b34fb [READ]
  // >> Characteristic: 00002a63-0000-1000-8000-00805f9b34fb [NOTIFY]
  // >> Characteristic: 00002a64-0000-1000-8000-00805f9b34fb [NOTIFY]
  // >> Characteristic: 00002a65-0000-1000-8000-00805f9b34fb [READ]
  // >> Characteristic: 00002a66-0000-1000-8000-00805f9b34fb [WRITE, INDICATE]

  async function connectDevice() {
    try {
      let newDevice = await navigator.bluetooth.requestDevice({
        filters: [{ name: "Tacx Smart Bike 17100" }],
        optionalServices: ["00001816-0000-1000-8000-00805f9b34fb"],
      });
      console.log("got new device", newDevice.name);
      newDevice.addEventListener("gattserverdisconnected", onDisconnected);
      if (newDevice?.gatt) {
        let server = await newDevice.gatt.connect();
        setDevice(newDevice);
        console.log("server", server);
        let service = await server.getPrimaryService(
          "00001816-0000-1000-8000-00805f9b34fb"
        );
        console.log("services", service);

        let cadence = await service.getCharacteristic(
          "00002a5b-0000-1000-8000-00805f9b34fb"
        );

        cadence.addEventListener(
          "characteristicvaluechanged",
          handleCadenceChange
        );
        await cadence.startNotifications();
        console.log("Listening for cadence changes...", cadence);
      }
    } catch (error) {
      console.error("Error connecting to device:", error);
    }
  }

  async function disconnectDevice() {
    if (device && device?.gatt && device?.gatt.connected) {
      try {
        await device.gatt.disconnect();
        console.log("Disconnected");
      } catch (error) {
        console.error("could not disconnect");
      }
    } else {
      console.warn("Device is not connected");
    }
  }

  function onDisconnected(event: Event) {
    const device = event.target as BluetoothDevice;
    console.log(`Device ${device.name} is disconnected.`);
  }

  function handleCadenceChange(event: Event) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;

    if (characteristic.value) {
      // Assuming the cadence data is in Little-Endian format and is a Uint16
      const dataView = new DataView(characteristic.value.buffer);
      const rawData = new Uint8Array(characteristic.value.buffer);
      console.log("Raw Data:", rawData);

      const measurements = extractCSCMeasurement(dataView, 0.5588);
      const rpms = measurements?.rpm || 0;

      console.log(`Cadence: ${rpms} rpm`);
    } else {
      console.warn("Received characteristic value is empty.");
    }
  }

  function extractCSCMeasurement(
    dataView: DataView,
    wheelCircumferenceMeters: number
  ): CSCMeasurement {
    const flags = dataView.getUint8(0);

    const wheelRevolutionDataPresent = (flags & 0x01) !== 0;
    const crankRevolutionDataPresent = (flags & 0x02) !== 0;

    let offset = 1; // Start reading data after the Flags field

    const result: CSCMeasurement = {
      wheelRevolutionDataPresent,
      crankRevolutionDataPresent,
    };

    if (wheelRevolutionDataPresent) {
      result.cumulativeWheelRevolutions = dataView.getUint32(offset, true);
      offset += 4;
      result.lastWheelEventTime = dataView.getUint16(offset, true);
      offset += 2;
    }

    if (crankRevolutionDataPresent) {
      result.cumulativeCrankRevolutions = dataView.getUint16(offset, true);
      offset += 2;
      result.lastCrankEventTime = dataView.getUint16(offset, true);
      offset += 2;
    }

    // Calculate RPM and speed based on extracted data and previousMeasurement
    if (previousMeasurement) {
      if (result.crankRevolutionDataPresent) {
        result.rpm = calculateRPM(result, previousMeasurement);
      }

      if (result.wheelRevolutionDataPresent) {
        result.speedKmH = calculateSpeedKmH(
          result,
          previousMeasurement,
          wheelCircumferenceMeters
        );
      }
    }

    // Update previousMeasurement with the current data
    previousMeasurement = { ...result };

    return result;
  }

  // function extractCSCMeasurement(
  //   data: DataView,
  //   wheelCircumferenceMeters: number
  // ): CSCMeasurement {
  //   let offset = 0;
  //   const flags = data.getUint8(offset++);
  //   const result: CSCMeasurement = {
  //     wheelRevolutionDataPresent: !!(flags & 0x01),
  //     crankRevolutionDataPresent: !!(flags & 0x02),
  //   };

  //   if (result.wheelRevolutionDataPresent) {
  //     result.cumulativeWheelRevolutions = data.getUint32(offset, true); // true for little-endian
  //     offset += 4;
  //     result.lastWheelEventTime = data.getUint16(offset, true);
  //     offset += 2;
  //   }

  //   if (result.crankRevolutionDataPresent) {
  //     result.cumulativeCrankRevolutions = data.getUint32(offset, true);
  //     offset += 4;
  //     if (offset + 2 <= data.byteLength) {
  //       result.lastCrankEventTime = data.getUint16(offset, true);
  //       offset += 2;
  //     }
  //   }

  //   // If we have a previous measurement, calculate the derived metrics
  //   if (previousMeasurement) {
  //     console.log("yep, previous measurement");
  //     if (result.crankRevolutionDataPresent) {
  //       console.log("we should have an RPM");
  //       result.rpm = calculateRPM(result, previousMeasurement);
  //     }

  //     if (result.wheelRevolutionDataPresent) {
  //       result.speedKmH = calculateSpeedKmH(
  //         result,
  //         previousMeasurement,
  //         wheelCircumferenceMeters
  //       );
  //     }
  //   }

  //   previousMeasurement = { ...result };
  //   return result;
  // }

  // function calculateRPM(
  //   current: CSCMeasurement,
  //   previous: CSCMeasurement
  // ): number {
  //   console.log("current", current);
  //   console.log("previous", previous);
  //   const deltaRevolutions =
  //     current.cumulativeCrankRevolutions! -
  //     previous.cumulativeCrankRevolutions!;
  //   console.log("delta revolutions", deltaRevolutions);
  //   const deltaTime =
  //     current.lastCrankEventTime! - previous.lastCrankEventTime!;
  //   console.log("deltaTime", deltaTime);
  //   const rpm = (deltaRevolutions / deltaTime) * 60 * 1024; // deltaTime is in 1/1024 seconds
  //   console.log("calculate rpm", rpm);
  //   return rpm;
  // }

  function calculateRPM(
    current: CSCMeasurement,
    previous: CSCMeasurement
  ): number {
    console.log("c", current);
    console.log("p", previous);

    if (
      typeof current.cumulativeCrankRevolutions !== "number" ||
      typeof previous.cumulativeCrankRevolutions !== "number" ||
      typeof current.lastCrankEventTime !== "number" ||
      typeof previous.lastCrankEventTime !== "number"
    ) {
      console.log("BAD!");
      return 0; // If any value is not a number, return RPM as 0
    }

    const deltaRevolutions =
      current.cumulativeCrankRevolutions - previous.cumulativeCrankRevolutions;
    console.log("deltaRevs?", deltaRevolutions);
    let deltaTime = current.lastCrankEventTime - previous.lastCrankEventTime;
    console.log("deltaTime?", deltaTime);

    // Handle potential overflow
    if (deltaTime < 0) {
      deltaTime += 65536; // Add 2^16 to correct the value
    }

    if (deltaTime === 0) return 0; // Avoid division by zero

    const rpm = (deltaRevolutions / deltaTime) * 60 * 1024; // deltaTime is in 1/1024 seconds
    return rpm;
  }

  function calculateSpeedKmH(
    current: CSCMeasurement,
    previous: CSCMeasurement,
    wheelCircumferenceMeters: number
  ): number {
    const deltaRevolutions =
      current.cumulativeWheelRevolutions! -
      previous.cumulativeWheelRevolutions!;
    const deltaTimeHours =
      (current.lastWheelEventTime! - previous.lastWheelEventTime!) /
      (60 * 60 * 1024); // deltaTime is in 1/1024 seconds
    const speedKmH =
      (deltaRevolutions * wheelCircumferenceMeters) / deltaTimeHours;
    return speedKmH;
  }

  return (
    <>
      <button onClick={() => connectDevice()}>Connect Device</button>
      <button onClick={() => disconnectDevice()}>Disconnect Device</button>
    </>
  );
}

export default App;
