# Manufacturing Line PackML MQTT Simulator

## Helm Chart 

This Helm chart deploys the simulator as a kubernetes stateful set which can be scaled out to simulate a larger number of production lines.

### How to use

Assuming you already have a kubernetes cluster and helm installed,

From the chart directory run the following command

```
helm install packml-sim .
```
